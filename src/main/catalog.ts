import { createHash, randomUUID } from 'node:crypto';
import { lstat, realpath, readdir, open, mkdir, readFile } from 'node:fs/promises';
import { join, relative, isAbsolute, basename, dirname, sep } from 'node:path';
import { Store } from './store';
import { decodePng, MAX_BYTES } from './png';
import { decodeGame, encodeGame, pngPath, validateKey, encryptedPath } from './codec';
import type { Asset, Project, ScanProgress } from '../shared/contracts';
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const key = (s: string) => (process.platform === 'win32' ? s.toLowerCase() : s);
export async function confined(root: string, rel: string) {
  if (!rel || isAbsolute(rel) || rel.split(/[\\/]/).some((p) => p === '..' || p === ''))
    throw Error('不合法的相對路徑');
  let p = root;
  for (const part of rel.split(/[\\/]/)) {
    p = join(p, part);
    if ((await lstat(p)).isSymbolicLink()) throw Error('不讀取連結或接合點');
  }
  const resolved = await realpath(p),
    delta = relative(root, resolved);
  if (delta.startsWith('..' + sep) || delta === '..' || isAbsolute(delta))
    throw Error('路徑超出專案範圍');
  return resolved;
}
export async function stableRead(path: string, max = MAX_BYTES) {
  const f = await open(path, 'r');
  try {
    const before = await f.stat();
    if (!before.isFile() || before.size > max) throw Error('檔案非一般檔案，或超過大小限制');
    const b = Buffer.alloc(before.size + 1);
    let n = 0;
    while (n < b.length) {
      const r = await f.read(b, n, b.length - n, n);
      if (!r.bytesRead) break;
      n += r.bytesRead;
    }
    const after = await f.stat();
    if (
      n !== before.size ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw Error('讀取期間檔案變更，請關閉其他修改程式');
    return b.subarray(0, n);
  } finally {
    await f.close();
  }
}
export async function detectGame(selected: string) {
  const base = await realpath(selected),
    found: {
      root: string;
      engine: 'MV' | 'MZ';
      name: string;
      encryptionKey: string | null;
      systemHash: string;
    }[] = [];
  for (const candidate of [base, join(base, 'www')]) {
    try {
      const root = await realpath(candidate);
      if (candidate !== base && (await lstat(candidate)).isSymbolicLink()) continue;
      const systemBytes = await stableRead(
        await confined(root, 'data/System.json'),
        8 * 1024 * 1024,
      );
      const system = JSON.parse(systemBytes.toString('utf8'));
      if (!system || typeof system !== 'object') continue;
      for (const [engine, file] of [
        ['MV', 'rpg_core.js'],
        ['MZ', 'rmmz_core.js'],
      ] as const) {
        try {
          const code = (
            await stableRead(await confined(root, 'js/' + file), 8 * 1024 * 1024)
          ).toString('utf8');
          if (!new RegExp('Utils\\.RPGMAKER_NAME\\s*=\\s*[\'\"]' + engine + '[\'\"]').test(code))
            continue;
          if (!(await lstat(await confined(root, 'img'))).isDirectory()) continue;
          const encryptionKey =
            system.hasEncryptedImages === true ? validateKey(system.encryptionKey) : null;
          found.push({
            root,
            engine,
            encryptionKey,
            systemHash: hash(systemBytes),
            name: typeof system.gameTitle === 'string' ? system.gameTitle : basename(base),
          });
        } catch (e) {
          if (e instanceof Error && e.message.includes('金鑰')) throw e;
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('金鑰')) throw e;
    }
  }
  if (found.length !== 1)
    throw Error(
      found.length
        ? '找到多個引擎位置，請直接選擇正確的素材根目錄'
        : '無法辨識標準 MV／MZ 遊戲；需要 data/System.json、核心腳本及 img 資料夾',
    );
  return found[0];
}
export class Catalog {
  private previewTail: Promise<unknown> = Promise.resolve();
  private busy = false;
  private aborted = false;
  progress: ScanProgress = { running: false, processed: 0, errors: 0, current: '' };
  constructor(
    private store: Store,
    private dataRoot: string,
  ) {
    store.db
      .exec(`CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,root TEXT NOT NULL,root_key TEXT UNIQUE NOT NULL,engine TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,path TEXT NOT NULL,hash TEXT,width INTEGER,height INTEGER,alpha INTEGER,error TEXT,UNIQUE(project_id,path));`);
    store.db.exec(
      'CREATE TABLE IF NOT EXISTS project_codecs(project_id TEXT PRIMARY KEY REFERENCES projects(id),encryption_key TEXT,system_hash TEXT NOT NULL)',
    );
    store.db.prepare("UPDATE projects SET status='interrupted' WHERE status='scanning'").run();
  }
  list() {
    return this.store.db
      .prepare('SELECT id,name,root,engine,status,created FROM projects ORDER BY created DESC')
      .all() as Project[];
  }
  assets(id: unknown) {
    this.project(id);
    return this.store.db
      .prepare(
        'SELECT id,project_id AS projectId,path,hash,width,height,alpha,error FROM assets WHERE project_id=? ORDER BY path',
      )
      .all(id) as Asset[];
  }
  private project(id: unknown) {
    if (typeof id !== 'string') throw Error('專案 ID 無效');
    const p = this.list().find((p) => p.id === id);
    if (!p) throw Error('找不到專案');
    return p;
  }
  cancel() {
    this.aborted = true;
  }
  async create(selected: string, name: string, confirmed: boolean) {
    if (this.busy) throw Error('已有掃描正在執行');
    if (confirmed !== true) throw Error('請先確認來源為未修改的測試副本');
    if (typeof name !== 'string' || name.trim().length > 100) throw Error('專案名稱最多 100 字');
    this.busy = true;
    this.aborted = false;
    this.progress = { running: true, processed: 0, errors: 0, current: '辨識遊戲…' };
    let id: string | undefined;
    try {
      const game = await detectGame(selected);
      const managed = await realpath(this.dataRoot);
      for (const [a, b] of [
        [managed, game.root],
        [game.root, managed],
      ]) {
        const rel = relative(a, b);
        if (!rel || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel)))
          throw Error('遊戲位置與工具資料目錄不可重疊');
      }
      if (this.store.db.prepare('SELECT id FROM projects WHERE root_key=?').get(key(game.root)))
        throw Error('這個遊戲位置已有專案，請開啟原專案');
      id = randomUUID();
      const folder = join(this.dataRoot, 'projects', id, 'originals');
      await mkdir(folder, { recursive: true });
      this.store.db
        .prepare('INSERT INTO projects VALUES(?,?,?,?,?,?,?)')
        .run(
          id,
          name.trim() || game.name,
          game.root,
          key(game.root),
          game.engine,
          'scanning',
          new Date().toISOString(),
        );
      const projectId = id;
      this.store.db
        .prepare('INSERT INTO project_codecs VALUES(?,?,?)')
        .run(id, game.encryptionKey, game.systemHash);
      const recordError = (path: string, error: string) => {
        this.store.db
          .prepare('INSERT INTO assets(id,project_id,path,error) VALUES(?,?,?,?)')
          .run(randomUUID(), projectId, path, error);
        this.progress.errors++;
      };
      const visit = async (rel: string): Promise<void> => {
        if (this.aborted) return;
        let entries;
        try {
          entries = await readdir(await confined(game.root, rel), { withFileTypes: true });
        } catch (e) {
          recordError(rel, String(e));
          return;
        }
        for (const entry of entries) {
          if (this.aborted) return;
          const path = rel + '/' + entry.name;
          this.progress.current = path;
          if (entry.isSymbolicLink()) {
            recordError(path, '跳過符號連結／接合點');
            continue;
          }
          if (entry.isDirectory()) {
            await visit(path);
            continue;
          }
          if (!/\.(png|rpgmvp|png_)$/i.test(path)) continue;
          const assetId = randomUUID();
          let bytes: Buffer;
          let preview;
          try {
            if (
              encryptedPath(path) &&
              !path.toLowerCase().endsWith(game.engine === 'MV' ? '.rpgmvp' : '.png_')
            )
              throw Error('加密副檔名與引擎不符');
            const source = await confined(game.root, path);
            bytes = await stableRead(source);
            preview = await decodePng(
              decodeGame(bytes, path, game.encryptionKey),
              pngPath(entry.name),
            );
            const current = await stableRead(await confined(game.root, path));
            if (hash(current) !== hash(bytes)) throw Error('掃描時來源變更，未建立基準');
          } catch (e) {
            recordError(path, e instanceof Error ? e.message : String(e));
            this.progress.processed++;
            continue;
          }
          // Storage failures abort the scan instead of being disguised as invalid images.
          const target = join(folder, assetId + '.png'),
            f = await open(target, 'wx');
          try {
            await f.writeFile(bytes);
            await f.sync();
          } finally {
            await f.close();
          }
          if (hash(await readFile(target)) !== hash(bytes)) throw Error('原始備份驗證失敗');
          this.store.db
            .prepare(
              'INSERT INTO assets(id,project_id,path,hash,width,height,alpha) VALUES(?,?,?,?,?,?,?)',
            )
            .run(
              assetId,
              projectId,
              path,
              hash(bytes),
              preview.width,
              preview.height,
              Number(preview.hasAlpha),
            );
          this.progress.processed++;
        }
      };
      await visit('img');
      this.store.db
        .prepare('UPDATE projects SET status=? WHERE id=?')
        .run(this.aborted ? 'cancelled' : this.progress.errors ? 'warnings' : 'ready', id);
      return this.project(id);
    } catch (e) {
      if (id) this.store.db.prepare("UPDATE projects SET status='failed' WHERE id=?").run(id);
      throw e;
    } finally {
      this.busy = false;
      this.progress.running = false;
      this.progress.current = '';
    }
  }
  codec(id: string) {
    return this.store.db
      .prepare(
        'SELECT encryption_key AS key,system_hash AS systemHash FROM project_codecs WHERE project_id=?',
      )
      .get(id) as { key: string | null; systemHash: string } | undefined;
  }
  decode(id: string, path: string, bytes: Buffer) {
    return decodeGame(bytes, path, this.codec(id)?.key ?? null);
  }
  encode(id: string, path: string, bytes: Buffer) {
    return encodeGame(bytes, path, this.codec(id)?.key ?? null);
  }
  async validateGame(id: string) {
    const project = this.project(id),
      codec = this.codec(id);
    if (
      codec &&
      hash(await stableRead(await confined(project.root, 'data/System.json'), 8 * 1024 * 1024)) !==
        codec.systemHash
    )
      throw Error('遊戲設定自建立後已變更，禁止寫入');
  }
  async relink(id: string, selected: string) {
    if (this.busy) throw Error('掃描中不可重新連結');
    const project = this.project(id),
      game = await detectGame(selected);
    if (game.engine !== project.engine) throw Error('引擎與原專案不一致');
    const codec = this.codec(id);
    if (codec && (codec.key !== game.encryptionKey || codec.systemHash !== game.systemHash))
      throw Error('遊戲設定與原專案不一致');
    const managed = await realpath(this.dataRoot);
    for (const [a, b] of [
      [managed, game.root],
      [game.root, managed],
    ]) {
      const r = relative(a, b);
      if (!r || (!r.startsWith('..' + sep) && r !== '..' && !isAbsolute(r)))
        throw Error('不可連結到工具資料位置');
    }
    const existing = this.list().find((p) => key(p.root) === key(game.root) && p.id !== id);
    if (existing) throw Error('此位置已有其他專案');
    const assets = this.assets(id);
    if (!assets.length || assets.some((a) => a.error || !a.hash))
      throw Error('專案掃描不完整，無法安全重新連結');
    const found: string[] = [];
    const visit = async (rel: string): Promise<void> => {
      for (const e of await readdir(await confined(game.root, rel), { withFileTypes: true })) {
        if (e.isSymbolicLink()) throw Error('新位置含連結');
        const path = rel + '/' + e.name;
        if (e.isDirectory()) await visit(path);
        else if (/\.(png|rpgmvp|png_)$/i.test(path)) found.push(path);
      }
    };
    await visit('img');
    if (
      found.length !== assets.length ||
      found.some((path) => !assets.some((a) => a.path === path))
    )
      throw Error('素材路徑清單與原專案不一致');
    for (const a of assets) {
      const state = this.store.db
        .prepare('SELECT deployed FROM selections WHERE asset_id=?')
        .get(a.id) as { deployed: string | null } | undefined;
      let expected = a.hash;
      if (state?.deployed) {
        const v = this.store.db
          .prepare('SELECT hash FROM versions WHERE id=? AND asset_id=?')
          .get(state.deployed, a.id) as { hash: string } | undefined;
        if (!v) throw Error('部署紀錄不完整');
        const stored = await stableRead(
          await confined(
            await realpath(this.dataRoot),
            `projects/${id}/versions/${state.deployed}.png`,
          ),
        );
        if (hash(stored) !== v.hash) throw Error('版本備份損壞');
        expected = hash(this.encode(id, a.path, stored));
      }
      if (hash(await stableRead(await confined(game.root, a.path))) !== expected)
        throw Error('素材內容不一致：' + a.path);
    }
    this.store.db
      .prepare('UPDATE projects SET root=?,root_key=? WHERE id=?')
      .run(game.root, key(game.root), id);
    return this.project(id);
  }
  preview(id: unknown) {
    const result = this.previewTail.then(() => this.previewOne(id));
    this.previewTail = result.catch(() => undefined);
    return result;
  }
  private async previewOne(id: unknown) {
    if (typeof id !== 'string') throw Error('素材 ID 無效');
    const asset = this.store.db
      .prepare('SELECT id,project_id AS projectId,path,hash,error FROM assets WHERE id=?')
      .get(id) as Asset | undefined;
    if (!asset || asset.error || !asset.hash) throw Error('素材沒有可用的原始基準');
    const path = await confined(
      await realpath(this.dataRoot),
      'projects/' + asset.projectId + '/originals/' + asset.id + '.png',
    );
    const bytes = await stableRead(path);
    if (hash(bytes) !== asset.hash) throw Error('原始備份損壞，禁止使用');
    return decodePng(
      this.decode(asset.projectId, asset.path, bytes),
      pngPath(basename(asset.path)),
    );
  }
}
