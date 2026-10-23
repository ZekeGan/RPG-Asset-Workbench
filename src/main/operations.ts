import { randomUUID, createHash } from 'node:crypto';
import { mkdir, open, rename, unlink, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { Store } from './store';
import { Catalog, confined, stableRead } from './catalog';
import { Versions } from './versions';
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
interface Item {
  assetId: string;
  path: string;
  before: string;
  after: string;
  previous: string | null;
  next: string | null;
}
export interface Operation {
  id: string;
  projectId: string;
  kind: 'apply' | 'restore';
  status: string;
  items: Item[];
  error: string | null;
}
// Fault callback is only injected by tests; never exposed over IPC.
export class Operations {
  busy = false;
  constructor(
    private store: Store,
    private catalog: Catalog,
    private versions: Versions,
    private dataRoot: string,
    private fault?: (point: string, index: number) => void,
  ) {
    store.db.exec(
      'CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,items TEXT NOT NULL,error TEXT)',
    );
  }
  list(projectId: string) {
    return (
      this.store.db
        .prepare(
          'SELECT id,project_id AS projectId,kind,status,items,error FROM operations WHERE project_id=? ORDER BY rowid DESC',
        )
        .all(projectId) as (Omit<Operation, 'items'> & { items: string })[]
    ).map((o) => ({ ...o, items: JSON.parse(o.items) as Item[] }));
  }
  pending(projectId: string) {
    return this.catalog
      .assets(projectId)
      .filter((a) => !a.error)
      .filter((a) => {
        const s = this.versions.state(a.id);
        return s.active !== s.deployed;
      })
      .map((a) => a.id);
  }
  assertEditable(projectId: string) {
    if (
      this.busy ||
      this.list(projectId).some((o) => !['committed', 'recovered', 'cancelled'].includes(o.status))
    )
      throw Error('專案有未完成操作，請先恢復');
  }
  private update(id: string, status: string, error: string | null = null) {
    this.store.db
      .prepare('UPDATE operations SET status=?,error=? WHERE id=?')
      .run(status, error, id);
  }
  private async persist(path: string, bytes: Buffer) {
    const f = await open(path, 'wx');
    try {
      await f.writeFile(bytes);
      await f.sync();
    } finally {
      await f.close();
    }
    if (hash(await stableRead(path)) !== hash(bytes)) throw Error('備份寫入驗證失敗');
  }
  private async replace(root: string, path: string, expected: string, bytes: Buffer) {
    let temp: string | undefined;
    try {
      const target = await confined(root, path);
      if (hash(await stableRead(target)) !== expected) throw Error('偵測外部變更，禁止覆蓋');
      temp = join(dirname(target), '.rpg-tool-' + randomUUID());
      await this.persist(temp, bytes);
      const checked = await confined(root, path);
      if (hash(await stableRead(checked)) !== expected) throw Error('寫入前偵測外部變更');
      await rename(temp, checked);
      temp = undefined;
      if (hash(await stableRead(await confined(root, path))) !== hash(bytes))
        throw Error('寫入後驗證失敗');
    } finally {
      if (temp) await unlink(temp).catch(() => {});
    }
  }
  async execute(projectId: string, kind: 'apply' | 'restore', selected: string[] = []) {
    this.assertEditable(projectId);
    if (kind !== 'apply' && kind !== 'restore') throw Error('操作類型無效');
    this.busy = true;
    let op: Operation | undefined;
    try {
      const project = this.catalog.list().find((p) => p.id === projectId);
      if (!project) throw Error('專案不存在');
      if (kind === 'apply' && !['ready', 'warnings'].includes(project.status))
        throw Error('掃描尚未完成，請先繼續掃描；目前無法套用到遊戲');
      await this.catalog.validateGame(projectId);
      const ids = kind === 'apply' ? this.pending(projectId) : selected;
      if (!ids.length || new Set(ids).size !== ids.length) throw Error('沒有可操作項目或選擇重複');
      const staged: { item: Item; before: Buffer; after: Buffer }[] = [];
      for (const id of ids) {
        const a = this.versions.asset(id);
        if (a.projectId !== projectId) throw Error('跨專案操作遭拒');
        const state = this.versions.state(id);
        if (kind === 'restore' && !state.deployed) throw Error('素材沒有已部署替換');
        await this.versions.bytes(id, null);
        const previous = state.deployed,
          next = kind === 'apply' ? state.active : null;
        const before = await this.versions.gameBytes(id, previous),
          after = await this.versions.gameBytes(id, next);
        const current = await stableRead(await confined(project.root, a.path));
        if (hash(current) !== hash(before)) throw Error('遊戲檔案已被外部修改：' + a.path);
        staged.push({
          item: {
            assetId: id,
            path: a.path,
            before: hash(before),
            after: hash(after),
            previous,
            next,
          },
          before,
          after,
        });
      }
      const id = randomUUID(),
        base = await confined(await realpath(this.dataRoot), 'projects/' + projectId);
      await mkdir(join(base, 'operations'), { recursive: true });
      const parent = await confined(
          await realpath(this.dataRoot),
          'projects/' + projectId + '/operations',
        ),
        dir = join(parent, id);
      await mkdir(dir);
      op = {
        id,
        projectId,
        kind,
        status: 'preparing',
        items: staged.map((s) => s.item),
        error: null,
      };
      this.store.db
        .prepare('INSERT INTO operations VALUES(?,?,?,?,?,NULL)')
        .run(id, projectId, kind, 'preparing', JSON.stringify(op.items));
      for (const [i, s] of staged.entries()) {
        await this.persist(join(dir, i + '.before'), s.before);
        await this.persist(join(dir, i + '.after'), s.after);
      }
      this.update(id, 'prepared');
      this.fault?.('prepared', -1);
      this.update(id, 'applying');
      this.fault?.('intent', -1);
      for (const [i, s] of staged.entries()) {
        this.fault?.('before-write', i);
        await this.replace(project.root, s.item.path, s.item.before, s.after);
        this.fault?.('after-write', i);
      }
      this.fault?.('before-commit', -1);
      this.store.db.transaction(() => {
        for (const s of staged) {
          this.store.db
            .prepare('INSERT OR IGNORE INTO selections(asset_id) VALUES(?)')
            .run(s.item.assetId);
          this.store.db
            .prepare('UPDATE selections SET deployed=? WHERE asset_id=?')
            .run(s.item.next, s.item.assetId);
        }
        this.update(id, 'committed');
      })();
      return this.list(projectId).find((o) => o.id === id)!;
    } catch (e) {
      if (op) {
        try {
          await this.recoverInternal(op);
        } catch (recovery) {
          this.update(op.id, 'recovery_failed', String(recovery));
          throw Error('操作失敗且恢復未完成：' + String(recovery));
        }
      }
      throw e;
    } finally {
      this.busy = false;
    }
  }
  async recover(projectId: string, id: string) {
    if (this.busy) throw Error('正在寫入');
    const op = this.list(projectId).find((o) => o.id === id);
    if (!op || ['committed', 'recovered', 'cancelled'].includes(op.status))
      throw Error('操作無需恢復');
    this.busy = true;
    try {
      await this.recoverInternal(op);
      return this.list(projectId).find((o) => o.id === id)!;
    } catch (e) {
      this.update(id, 'recovery_failed', String(e));
      throw e;
    } finally {
      this.busy = false;
    }
  }
  private async recoverInternal(op: Operation) {
    const actual = this.list(op.projectId).find((o) => o.id === op.id)!;
    if (['preparing', 'prepared'].includes(actual.status)) {
      this.update(op.id, 'cancelled');
      return;
    }
    const project = this.catalog.list().find((p) => p.id === op.projectId);
    if (!project) throw Error('專案不存在');
    await this.catalog.validateGame(op.projectId);
    this.update(op.id, 'recovering');
    // Validate every backup and target before the first recovery write.
    const restore: Buffer[] = [];
    for (const [i, item] of op.items.entries()) {
      const b = await stableRead(
        await confined(
          await realpath(this.dataRoot),
          `projects/${op.projectId}/operations/${op.id}/${i}.before`,
        ),
      );
      if (hash(b) !== item.before) throw Error('操作前備份損壞');
      const current = hash(await stableRead(await confined(project.root, item.path)));
      if (current !== item.before && current !== item.after)
        throw Error('恢復遭外部變更阻擋：' + item.path);
      restore.push(b);
    }
    for (const [i, item] of op.items.entries()) {
      const current = hash(await stableRead(await confined(project.root, item.path)));
      if (current !== item.before)
        await this.replace(project.root, item.path, item.after, restore[i]);
      this.fault?.('recovery-write', i);
    }
    this.store.db.transaction(() => {
      for (const item of op.items) {
        this.store.db
          .prepare('INSERT OR IGNORE INTO selections(asset_id) VALUES(?)')
          .run(item.assetId);
        this.store.db
          .prepare('UPDATE selections SET deployed=? WHERE asset_id=?')
          .run(item.previous, item.assetId);
      }
      this.update(op.id, 'recovered');
    })();
  }
}
