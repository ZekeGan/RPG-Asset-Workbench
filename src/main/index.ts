import { t, isLocale, setLocale } from '../shared/i18n';
import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { open } from 'node:fs/promises';
import { Store } from './store';
import { Catalog, stableRead } from './catalog';
import { Versions } from './versions';
import { Exporter } from './exporter';
import { Operations } from './operations';
import { pngPath } from './codec';
import { ProjectDrafts } from './project-drafts';
import { WriteGuard } from './write-guard';
import { Groups } from './groups';
import { Projects } from './projects';
import { BatchImports } from './batch';
import { randomUUID } from 'node:crypto';
import { decodePng, MAX_BYTES, imageSize, MAX_PIXELS } from './png';
import type { Result } from '../shared/contracts';
let win: BrowserWindow | null = null,
  store: Store | undefined,
  pngBusy = false;
let catalog: Catalog | undefined, versions: Versions | undefined;
const projectDrafts = new ProjectDrafts();
const drafts = new Map<
  string,
  { assetId: string; bytes: Buffer; name: string; largeAccepted: boolean }
>();
async function confirmLarge(bytes: Buffer, name: string) {
  const size = imageSize(bytes);
  if (size.pixels <= MAX_PIXELS) return false;
  const answer = await dialog.showMessageBox(win!, {
    type: 'warning',
    message: t('確認大圖處理'),
    detail: t(
      '{0}\n{1} × {2}\n大圖處理可能使用較多記憶體與時間，將逐張處理並保留原檔。是否繼續？',
      [name, size.width, size.height],
    ),
    buttons: [t('取消'), t('繼續處理大圖')],
    defaultId: 0,
    cancelId: 0,
  });
  if (answer.response !== 1) throw Error(t('已取消大圖處理'));
  return true;
}
function getVersions() {
  return (versions ??= new Versions(getStore(), getCatalog(), app.getPath('userData')));
}
function getCatalog() {
  return (catalog ??= new Catalog(getStore(), app.getPath('userData')));
}
let operationService: Operations | undefined,
  taskBusy = false;
let groups: Groups | undefined, batch: BatchImports | undefined;
let projects: Projects | undefined;
const coverDrafts = new Map<string, { projectId: string; bytes: Buffer }>();
function getProjects() {
  return (projects ??= new Projects(
    getStore(),
    getCatalog(),
    getVersions(),
    getOperations(),
    app.getPath('userData'),
  ));
}
function getGroups() {
  return (groups ??= new Groups(getStore(), getCatalog()));
}
function getBatch() {
  return (batch ??= new BatchImports(getCatalog(), getVersions(), confirmLarge));
}
function getOperations() {
  return (operationService ??= new Operations(
    getStore(),
    getCatalog(),
    getVersions(),
    app.getPath('userData'),
  ));
}
function editableAsset(id: string) {
  getOperations().assertEditable(getVersions().asset(id).projectId);
}
let writeGuard: WriteGuard | undefined;
function getWriteGuard() {
  return (writeGuard ??= new WriteGuard(app.getPath('userData')));
}
let allowedUrl = '';
function getStore() {
  return (store ??= new Store(join(app.getPath('userData'), 'catalog.sqlite')));
}
if (!app.requestSingleInstanceLock()) app.quit();
else
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    win = new BrowserWindow({
      title: 'R-aW — RPG Asset Workbench',
      icon: join(app.getAppPath(), 'resources', 'icon.png'),
      width: 1120,
      height: 780,
      minWidth: 760,
      minHeight: 600,
      backgroundColor: '#1b1d21',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    allowedUrl = new URL(
      process.env.ELECTRON_RENDERER_URL ||
        pathToFileURL(join(__dirname, '../renderer/index.html')).href,
    ).href;
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => {
      if (url !== allowedUrl) event.preventDefault();
    });
    win.webContents.session.setPermissionRequestHandler((_web, _permission, callback) =>
      callback(false),
    );
    const handle = <T>(channel: string, fn: (...args: unknown[]) => T | Promise<T>) =>
      ipcMain.handle(channel, async (event, ...args): Promise<Result<T>> => {
        if (
          event.sender !== win?.webContents ||
          event.senderFrame !== win.webContents.mainFrame ||
          event.senderFrame.url !== allowedUrl
        )
          return { ok: false, error: t('拒絕未授權的操作來源') };
        const mutation = [
          'manager:cover-choose',
          'manager:cover-discard',
          'manager:project-save',
          'manager:project-delete',
          'manager:group-create',
          'manager:group-rename',
          'manager:group-change',
          'manager:batch-choose',
          'manager:batch-inspect',
          'manager:batch-commit',
          'manager:batch-discard',
          'manager:relink',
          'version:choose',
          'version:commit',
          'version:select',
          'version:remove',
          'version:export',
          'operation:execute',
          'operation:recover',
          'catalog:create',
          'catalog:choose',
          'catalog:scan-plan',
          'catalog:scan-commit',
          'manager:batch-drop',
          'version:drop',
        ].includes(channel);
        if (mutation && taskBusy) return { ok: false, error: t('另有操作正在執行，請稍候') };
        if (mutation) {
          try {
            getWriteGuard().assertWritable();
          } catch (e) {
            return { ok: false, error: t(String(e)) };
          }
        }
        if (mutation) taskBusy = true;
        try {
          return { ok: true, value: await fn(...args) };
        } catch (e) {
          if (mutation) getWriteGuard().record(e);
          return { ok: false, error: e instanceof Error ? t(e.message) : t('操作失敗') };
        } finally {
          if (mutation) taskBusy = false;
        }
      });
    handle('catalog:projects', () => getCatalog().list());
    handle('manager:locale', (locale) => {
      if (!isLocale(locale)) throw Error('Invalid locale');
      if (taskBusy) throw Error(t('另有操作正在執行，請稍候'));
      setLocale(locale);
    });
    handle('catalog:availability', (id) => {
      if (typeof id !== 'string') throw Error(t('專案 ID 無效'));
      return getCatalog().availability(id);
    });
    handle('catalog:scan-plan', (id) => {
      if (typeof id !== 'string') throw Error(t('專案 ID 無效'));
      getOperations().assertEditable(id);
      return getCatalog().scanPlan(id);
    });
    handle('catalog:scan-commit', (id, token) => {
      if (typeof id !== 'string' || typeof token !== 'string') throw Error(t('參數無效'));
      getOperations().assertEditable(id);
      return getCatalog().scanCommit(id, token);
    });
    handle('catalog:assets', (id) => getCatalog().assets(id));
    handle('catalog:preview', (id) => getCatalog().preview(id));
    handle('catalog:progress', () => ({ ...getCatalog().progress }));
    handle('catalog:cancel', () => getCatalog().cancel());
    handle('catalog:choose', async () => {
      projectDrafts.clear();
      const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] });
      if (result.canceled || !result.filePaths[0]) return null;
      return projectDrafts.choose(result.filePaths[0]);
    });
    handle('catalog:create', async (token, name, confirmed) => {
      if (typeof token !== 'string' || typeof name !== 'string' || typeof confirmed !== 'boolean')
        throw Error(t('建立專案參數不合法'));
      if (!confirmed) throw Error(t('請先確認未修改來源'));
      const root = await projectDrafts.consume(token);
      return getCatalog().create(root, name, confirmed);
    });
    handle('version:state', (id) => getVersions().state(id));
    handle('version:drop', async (id, paths) => {
      if (
        typeof id !== 'string' ||
        !Array.isArray(paths) ||
        paths.length !== 1 ||
        typeof paths[0] !== 'string' ||
        !paths[0]
      )
        throw Error(t('詳細頁只接受一張圖片'));
      editableAsset(id);
      const bytes = await stableRead(paths[0]),
        name = basename(paths[0]);
      const largeAccepted = await confirmLarge(bytes, name);
      const checked = await getVersions().check(id, bytes, name, largeAccepted),
        token = randomUUID();
      drafts.clear();
      drafts.set(token, { assetId: id, bytes, name, largeAccepted });
      return { token, ...checked };
    });
    handle('version:preview', (id, version) => {
      if (typeof id !== 'string' || (version !== null && typeof version !== 'string'))
        throw Error(t('參數無效'));
      return getVersions().preview(id, version);
    });
    handle('version:select', (id, version) => {
      if (typeof id !== 'string' || (version !== null && typeof version !== 'string'))
        throw Error(t('參數無效'));
      editableAsset(id);
      return getVersions().select(id, version);
    });
    handle('version:remove', (id, version, cancelActive = false) => {
      if (
        typeof id !== 'string' ||
        typeof version !== 'string' ||
        typeof cancelActive !== 'boolean'
      )
        throw Error(t('參數無效'));
      editableAsset(id);
      return getVersions().remove(id, version, cancelActive);
    });
    handle('version:discard', (token) => {
      if (typeof token === 'string') drafts.delete(token);
    });
    handle('version:choose', async (id) => {
      if (typeof id !== 'string') throw Error(t('素材 ID 無效'));
      getVersions().asset(id);
      const selected = await dialog.showOpenDialog(win!, {
        properties: ['openFile'],
        filters: [{ name: t('靜態 PNG'), extensions: ['png'] }],
      });
      if (selected.canceled) return null;
      const path = selected.filePaths[0],
        bytes = await stableRead(path),
        name = basename(path),
        largeAccepted = await confirmLarge(bytes, name),
        checked = await getVersions().check(id, bytes, name, largeAccepted);
      drafts.clear();
      const token = randomUUID();
      drafts.set(token, { assetId: id, bytes, name, largeAccepted });
      return { token, ...checked };
    });
    handle('version:commit', async (token, accepted) => {
      if (typeof token !== 'string' || typeof accepted !== 'boolean') throw Error(t('參數無效'));
      const draft = drafts.get(token);
      if (!draft) throw Error(t('匯入預覽已過期，請重新選圖'));
      editableAsset(draft.assetId);
      const result = await getVersions().importBatch([{ ...draft, accepted }]);
      drafts.delete(token);
      return result[0];
    });
    handle('version:export', async (ids, source) => {
      if (
        !Array.isArray(ids) ||
        ids.some((x) => typeof x !== 'string') ||
        (source !== 'original' && source !== 'active')
      )
        throw Error(t('匯出參數無效'));
      const selected = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory', 'createDirectory'],
      });
      if (selected.canceled) return null;
      const exporter = new Exporter(getVersions(), getCatalog(), app.getPath('userData')),
        plan = await exporter.prepare(ids, source, selected.filePaths[0]);
      let policy: 'skip' | 'overwrite' | 'cancel' = 'skip';
      if (plan.conflicts.length) {
        const answer = await dialog.showMessageBox(win!, {
          type: 'warning',
          message: t('{0} 個同名檔案', [plan.conflicts.length]),
          detail: plan.conflicts.join('\n'),
          buttons: [t('取消'), t('略過同名'), t('覆蓋清單中的同名檔')],
          defaultId: 0,
          cancelId: 0,
        });
        policy = answer.response === 2 ? 'overwrite' : answer.response === 1 ? 'skip' : 'cancel';
      }
      return exporter.run(plan, policy);
    });
    handle('operation:list', (id) => {
      if (typeof id !== 'string') throw Error(t('專案 ID 無效'));
      return getOperations().list(id);
    });
    handle('operation:execute', (id, kind, selected, confirmed) => {
      if (
        typeof id !== 'string' ||
        (kind !== 'apply' && kind !== 'restore') ||
        !Array.isArray(selected) ||
        selected.some((x) => typeof x !== 'string') ||
        confirmed !== true
      )
        throw Error(t('請確認操作清單'));
      return getOperations().execute(id, kind, selected);
    });
    handle('operation:recover', (id, operationId, confirmed) => {
      if (typeof id !== 'string' || typeof operationId !== 'string' || confirmed !== true)
        throw Error(t('請確認恢復'));
      return getOperations().recover(id, operationId);
    });
    handle('manager:groups', (id) => {
      if (typeof id !== 'string') throw Error(t('專案 ID 無效'));
      return getGroups().list(id);
    });
    handle('manager:cover', (id) => {
      if (typeof id !== 'string') throw Error(t('專案 ID 無效'));
      return getProjects().cover(id);
    });
    handle('manager:cover-discard', () => {
      coverDrafts.clear();
    });
    handle('manager:cover-choose', async (id) => {
      if (
        typeof id !== 'string' ||
        !getCatalog()
          .list()
          .some((p) => p.id === id)
      )
        throw Error(t('專案不存在'));
      getOperations().assertEditable(id);
      const picked = await dialog.showOpenDialog(win!, {
        properties: ['openFile'],
        filters: [{ name: t('靜態 PNG'), extensions: ['png'] }],
      });
      if (picked.canceled || !picked.filePaths[0]) return null;
      const bytes = await stableRead(picked.filePaths[0]);
      const preview = await decodePng(bytes, basename(picked.filePaths[0]));
      const token = randomUUID();
      coverDrafts.clear();
      coverDrafts.set(token, { projectId: id, bytes });
      return { token, preview };
    });
    handle('manager:project-save', async (id, name, choice) => {
      if (
        typeof id !== 'string' ||
        typeof name !== 'string' ||
        !choice ||
        typeof choice !== 'object' ||
        !('kind' in choice)
      )
        throw Error(t('參數無效'));
      let bytes: Buffer | null | undefined;
      if (choice.kind === 'asset' && 'id' in choice && typeof choice.id === 'string') {
        if (getVersions().asset(choice.id).projectId !== id) throw Error(t('素材不屬於此專案'));
        bytes = await getVersions().bytes(choice.id, null);
      } else if (
        choice.kind === 'import' &&
        'token' in choice &&
        typeof choice.token === 'string'
      ) {
        const draft = coverDrafts.get(choice.token);
        if (!draft || draft.projectId !== id) throw Error(t('封面預覽已過期，請重新選圖'));
        bytes = draft.bytes;
      } else if (choice.kind === 'reset') bytes = null;
      else if (choice.kind !== 'keep') throw Error(t('封面參數無效'));
      const saved = await getProjects().save(id, name, bytes);
      coverDrafts.clear();
      return saved;
    });
    handle('manager:project-delete', async (id, confirmed, abandonRecovery) => {
      if (
        typeof id !== 'string' ||
        typeof confirmed !== 'boolean' ||
        typeof abandonRecovery !== 'boolean'
      )
        throw Error(t('刪除參數無效'));
      await getProjects().remove(id, confirmed, abandonRecovery);
      drafts.clear();
      coverDrafts.clear();
      getBatch().clear();
    });
    handle('manager:group-create', (id, name) => {
      if (typeof id !== 'string' || typeof name !== 'string') throw Error(t('參數無效'));
      getOperations().assertEditable(id);
      return getGroups().create(id, name);
    });
    handle('manager:group-rename', (project, id, name) => {
      if (typeof project !== 'string' || typeof id !== 'string' || typeof name !== 'string')
        throw Error(t('參數無效'));
      getOperations().assertEditable(project);
      return getGroups().rename(project, id, name);
    });
    handle('manager:group-change', (project, id, action, ids) => {
      if (
        typeof project !== 'string' ||
        typeof id !== 'string' ||
        !['add', 'remove', 'delete'].includes(String(action)) ||
        !Array.isArray(ids) ||
        ids.some((i) => typeof i !== 'string')
      )
        throw Error(t('參數無效'));
      getOperations().assertEditable(project);
      return getGroups().change(project, id, action as 'add' | 'remove' | 'delete', ids);
    });
    handle('manager:states', (id) => {
      if (typeof id !== 'string') throw Error(t('專案 ID 無效'));
      return Object.fromEntries(
        getCatalog()
          .assets(id)
          .filter((a) => !a.error)
          .map((a) => [a.id, getVersions().state(a.id)]),
      );
    });
    handle('manager:batch-choose', async (id) => {
      if (typeof id !== 'string') throw Error(t('專案 ID 無效'));
      getOperations().assertEditable(id);
      const selected = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: t('選擇匯入資料夾（內含 img 相對路徑可自動配對）'),
      });
      if (selected.canceled) return null;
      return getBatch().choose(id, selected.filePaths[0]);
    });
    handle('manager:batch-drop', (id, paths) => {
      if (
        typeof id !== 'string' ||
        !Array.isArray(paths) ||
        paths.some((p) => typeof p !== 'string')
      )
        throw Error(t('拖放參數無效'));
      getOperations().assertEditable(id);
      return getBatch().chooseFiles(id, paths);
    });
    handle('manager:batch-inspect', (token, id) => {
      if (typeof token !== 'string' || typeof id !== 'string') throw Error(t('參數無效'));
      return getBatch().inspect(token, id);
    });
    handle('manager:batch-preview', (token, full) => {
      if (typeof token !== 'string' || typeof full !== 'boolean') throw Error(t('參數無效'));
      return getBatch().preview(token, full);
    });
    handle('manager:batch-commit', (id, items) => {
      if (
        typeof id !== 'string' ||
        !Array.isArray(items) ||
        items.some(
          (i) =>
            !i ||
            typeof i !== 'object' ||
            typeof i.token !== 'string' ||
            typeof i.assetId !== 'string' ||
            typeof i.accepted !== 'boolean',
        )
      )
        throw Error(t('參數無效'));
      getOperations().assertEditable(id);
      return getBatch().commit(id, items);
    });
    handle('manager:batch-discard', () => getBatch().clear());
    handle('manager:relink', async (id) => {
      if (typeof id !== 'string') throw Error(t('專案 ID 無效'));
      getOperations().assertEditable(id);
      getVersions();
      const selected = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] });
      if (selected.canceled) return null;
      return getCatalog().relink(id, selected.filePaths[0]);
    });
    handle('manager:full-preview', async (id, version) => {
      if (typeof id !== 'string' || (version !== null && typeof version !== 'string'))
        throw Error(t('參數無效'));
      const bytes = await getVersions().bytes(id, version),
        p = await decodePng(
          bytes,
          pngPath(basename(getVersions().asset(id).path)),
          version !== null,
        );
      return { ...p, dataUrl: 'data:image/png;base64,' + bytes.toString('base64') };
    });
    handle('manager:storage', () => getWriteGuard().status());
    handle('manager:retry', async () => {
      if (taskBusy) throw Error(t('請等候目前操作結束'));
      taskBusy = true;
      try {
        return await getWriteGuard().retry(getStore());
      } finally {
        taskBusy = false;
      }
    });
    handle('poc:load', () => getStore().load());
    handle('poc:save', (note) => getStore().save(note));
    handle('poc:png', async () => {
      if (pngBusy) throw new Error(t('正在檢查圖片，請稍候'));
      pngBusy = true;
      try {
        const result = await dialog.showOpenDialog(win!, {
          properties: ['openFile'],
          filters: [{ name: 'PNG', extensions: ['png'] }],
        });
        if (result.canceled || !result.filePaths[0]) return null;
        const file = await open(result.filePaths[0], 'r');
        try {
          const stat = await file.stat();
          if (!stat.isFile() || stat.size > MAX_BYTES)
            throw new Error(t('檔案非一般檔案，或超過 PoC 32 MiB 上限'));
          // Bounded read even if another program grows the selected file.
          const buffer = Buffer.alloc(Math.min(stat.size + 1, MAX_BYTES + 1));
          let total = 0;
          while (total < buffer.length) {
            const r = await file.read(buffer, total, buffer.length - total, total);
            if (!r.bytesRead) break;
            total += r.bytesRead;
          }
          return await decodePng(buffer.subarray(0, total), basename(result.filePaths[0]));
        } finally {
          await file.close();
        }
      } finally {
        pngBusy = false;
      }
    });
    let discardAndClose = false,
      closeDialog = false;
    win.on('close', (event) => {
      if (catalog?.progress.running) {
        event.preventDefault();
        catalog.cancel();
      } else if (taskBusy) {
        event.preventDefault();
        void dialog.showMessageBox(win!, {
          message: t('操作尚未完成，請等待保存或恢復結束再關閉。'),
        });
      } else if (!discardAndClose && getWriteGuard().status().blocked) {
        event.preventDefault();
        if (closeDialog) return;
        closeDialog = true;
        void dialog
          .showMessageBox(win!, {
            type: 'warning',
            message: t('儲存失敗尚未解除'),
            detail: t(
              '重試儲存檢查，或放棄尚未保存的暫存輸入並關閉。未完成遊戲操作紀錄仍保留，關閉不代表已恢復。',
            ),
            buttons: [t('重試'), t('取消'), t('放棄未儲存變更並關閉')],
            defaultId: 0,
            cancelId: 1,
          })
          .then(async (r) => {
            if (r.response === 0) {
              try {
                await getWriteGuard().retry(getStore());
              } catch (e) {
                await dialog.showMessageBox(win!, { type: 'error', message: t(String(e)) });
              }
            } else if (r.response === 2) {
              drafts.clear();
              getBatch().clear();
              discardAndClose = true;
              win?.close();
            }
          })
          .finally(() => {
            closeDialog = false;
          });
      }
    });
    win.loadURL(allowedUrl);
  });
app.on('second-instance', () => {
  win?.show();
  win?.focus();
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => store?.close());
