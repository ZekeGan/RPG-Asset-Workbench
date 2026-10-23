import { app, BrowserWindow, dialog, ipcMain } from 'electron';
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
import { BatchImports } from './batch';
import { randomUUID } from 'node:crypto';
import { decodePng, MAX_BYTES } from './png';
import type { Result } from '../shared/contracts';
let win: BrowserWindow | null = null,
  store: Store | undefined,
  pngBusy = false;
let catalog: Catalog | undefined, versions: Versions | undefined;
const projectDrafts = new ProjectDrafts();
const drafts = new Map<string, { assetId: string; bytes: Buffer; name: string }>();
function getVersions() {
  return (versions ??= new Versions(getStore(), getCatalog(), app.getPath('userData')));
}
function getCatalog() {
  return (catalog ??= new Catalog(getStore(), app.getPath('userData')));
}
let operationService: Operations | undefined,
  taskBusy = false;
let groups: Groups | undefined, batch: BatchImports | undefined;
function getGroups() {
  return (groups ??= new Groups(getStore(), getCatalog()));
}
function getBatch() {
  return (batch ??= new BatchImports(getCatalog(), getVersions()));
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
    win = new BrowserWindow({
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
          return { ok: false, error: '拒絕未授權的操作來源' };
        const mutation = [
          'manager:group-create',
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
        if (mutation && taskBusy) return { ok: false, error: '另有操作正在執行，請稍候' };
        if (mutation) {
          try {
            getWriteGuard().assertWritable();
          } catch (e) {
            return { ok: false, error: String(e) };
          }
        }
        if (mutation) taskBusy = true;
        try {
          return { ok: true, value: await fn(...args) };
        } catch (e) {
          if (mutation) getWriteGuard().record(e);
          return { ok: false, error: e instanceof Error ? e.message : '操作失敗' };
        } finally {
          if (mutation) taskBusy = false;
        }
      });
    handle('catalog:projects', () => getCatalog().list());
    handle('catalog:availability', (id) => {
      if (typeof id !== 'string') throw Error('專案 ID 無效');
      return getCatalog().availability(id);
    });
    handle('catalog:scan-plan', (id) => {
      if (typeof id !== 'string') throw Error('專案 ID 無效');
      getOperations().assertEditable(id);
      return getCatalog().scanPlan(id);
    });
    handle('catalog:scan-commit', (id, token) => {
      if (typeof id !== 'string' || typeof token !== 'string') throw Error('參數無效');
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
        throw Error('建立專案參數不合法');
      if (!confirmed) throw Error('請先確認未修改來源');
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
        throw Error('詳細頁只接受一張圖片');
      editableAsset(id);
      const bytes = await stableRead(paths[0]),
        name = basename(paths[0]);
      const checked = await getVersions().check(id, bytes, name),
        token = randomUUID();
      drafts.clear();
      drafts.set(token, { assetId: id, bytes, name });
      return { token, ...checked };
    });
    handle('version:preview', (id, version) => {
      if (typeof id !== 'string' || (version !== null && typeof version !== 'string'))
        throw Error('參數無效');
      return getVersions().preview(id, version);
    });
    handle('version:select', (id, version) => {
      if (typeof id !== 'string' || (version !== null && typeof version !== 'string'))
        throw Error('參數無效');
      editableAsset(id);
      return getVersions().select(id, version);
    });
    handle('version:remove', (id, version) => {
      if (typeof id !== 'string' || typeof version !== 'string') throw Error('參數無效');
      editableAsset(id);
      return getVersions().remove(id, version);
    });
    handle('version:discard', (token) => {
      if (typeof token === 'string') drafts.delete(token);
    });
    handle('version:choose', async (id) => {
      if (typeof id !== 'string') throw Error('素材 ID 無效');
      getVersions().asset(id);
      const selected = await dialog.showOpenDialog(win!, {
        properties: ['openFile'],
        filters: [{ name: '靜態 PNG', extensions: ['png'] }],
      });
      if (selected.canceled) return null;
      const path = selected.filePaths[0],
        bytes = await stableRead(path),
        name = basename(path),
        checked = await getVersions().check(id, bytes, name);
      drafts.clear();
      const token = randomUUID();
      drafts.set(token, { assetId: id, bytes, name });
      return { token, ...checked };
    });
    handle('version:commit', async (token, accepted) => {
      if (typeof token !== 'string' || typeof accepted !== 'boolean') throw Error('參數無效');
      const draft = drafts.get(token);
      if (!draft) throw Error('匯入預覽已過期，請重新選圖');
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
        throw Error('匯出參數無效');
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
          message: `${plan.conflicts.length} 個同名檔案`,
          detail: plan.conflicts.join('\n'),
          buttons: ['取消', '略過同名', '覆蓋清單中的同名檔'],
          defaultId: 0,
          cancelId: 0,
        });
        policy = answer.response === 2 ? 'overwrite' : answer.response === 1 ? 'skip' : 'cancel';
      }
      return exporter.run(plan, policy);
    });
    handle('operation:list', (id) => {
      if (typeof id !== 'string') throw Error('專案 ID 無效');
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
        throw Error('請確認操作清單');
      return getOperations().execute(id, kind, selected);
    });
    handle('operation:recover', (id, operationId, confirmed) => {
      if (typeof id !== 'string' || typeof operationId !== 'string' || confirmed !== true)
        throw Error('請確認恢復');
      return getOperations().recover(id, operationId);
    });
    handle('manager:groups', (id) => {
      if (typeof id !== 'string') throw Error('專案 ID 無效');
      return getGroups().list(id);
    });
    handle('manager:group-create', (id, name) => {
      if (typeof id !== 'string' || typeof name !== 'string') throw Error('參數無效');
      getOperations().assertEditable(id);
      return getGroups().create(id, name);
    });
    handle('manager:group-change', (project, id, action, ids) => {
      if (
        typeof project !== 'string' ||
        typeof id !== 'string' ||
        !['add', 'remove', 'delete'].includes(String(action)) ||
        !Array.isArray(ids) ||
        ids.some((i) => typeof i !== 'string')
      )
        throw Error('參數無效');
      getOperations().assertEditable(project);
      return getGroups().change(project, id, action as 'add' | 'remove' | 'delete', ids);
    });
    handle('manager:states', (id) => {
      if (typeof id !== 'string') throw Error('專案 ID 無效');
      return Object.fromEntries(
        getCatalog()
          .assets(id)
          .filter((a) => !a.error)
          .map((a) => [a.id, getVersions().state(a.id)]),
      );
    });
    handle('manager:batch-choose', async (id) => {
      if (typeof id !== 'string') throw Error('專案 ID 無效');
      getOperations().assertEditable(id);
      const selected = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: '選擇匯入資料夾（內含 img 相對路徑可自動配對）',
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
        throw Error('拖放參數無效');
      getOperations().assertEditable(id);
      return getBatch().chooseFiles(id, paths);
    });
    handle('manager:batch-inspect', (token, id) => {
      if (typeof token !== 'string' || typeof id !== 'string') throw Error('參數無效');
      return getBatch().inspect(token, id);
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
        throw Error('參數無效');
      getOperations().assertEditable(id);
      return getBatch().commit(id, items);
    });
    handle('manager:batch-discard', () => getBatch().clear());
    handle('manager:relink', async (id) => {
      if (typeof id !== 'string') throw Error('專案 ID 無效');
      getOperations().assertEditable(id);
      getVersions();
      const selected = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] });
      if (selected.canceled) return null;
      return getCatalog().relink(id, selected.filePaths[0]);
    });
    handle('manager:full-preview', async (id, version) => {
      if (typeof id !== 'string' || (version !== null && typeof version !== 'string'))
        throw Error('參數無效');
      const bytes = await getVersions().bytes(id, version),
        p = await decodePng(bytes, pngPath(basename(getVersions().asset(id).path)));
      return { ...p, dataUrl: 'data:image/png;base64,' + bytes.toString('base64') };
    });
    handle('manager:storage', () => getWriteGuard().status());
    handle('manager:retry', async () => {
      if (taskBusy) throw Error('請等候目前操作結束');
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
      if (pngBusy) throw new Error('正在檢查圖片，請稍候');
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
            throw new Error('檔案非一般檔案，或超過 PoC 32 MiB 上限');
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
        void dialog.showMessageBox(win!, { message: '操作尚未完成，請等待保存或恢復結束再關閉。' });
      } else if (!discardAndClose && getWriteGuard().status().blocked) {
        event.preventDefault();
        if (closeDialog) return;
        closeDialog = true;
        void dialog
          .showMessageBox(win!, {
            type: 'warning',
            message: '儲存失敗尚未解除',
            detail:
              '重試儲存檢查，或放棄尚未保存的暫存輸入並關閉。未完成遊戲操作紀錄仍保留，關閉不代表已恢復。',
            buttons: ['重試', '取消', '放棄未儲存變更並關閉'],
            defaultId: 0,
            cancelId: 1,
          })
          .then(async (r) => {
            if (r.response === 0) {
              try {
                await getWriteGuard().retry(getStore());
              } catch (e) {
                await dialog.showMessageBox(win!, { type: 'error', message: String(e) });
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
