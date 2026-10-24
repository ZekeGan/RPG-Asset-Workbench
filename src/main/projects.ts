import { randomUUID } from 'node:crypto';
import { lstat, readdir, realpath, rm, open, readFile, unlink } from 'node:fs/promises';
import { join, relative, isAbsolute, sep, resolve } from 'node:path';
import { Store } from './store';
import { Catalog, confined } from './catalog';
import { Versions } from './versions';
import { Operations } from './operations';
import { Groups } from './groups';
import { decodePng } from './png';

// Files belong to one project; deletion never traverses a game or a shared database.
export class Projects {
  private busy = false;
  constructor(
    private store: Store,
    private catalog: Catalog,
    private versions: Versions,
    private operations: Operations,
    private root: string,
    private fault?: (stage: 'files' | 'metadata') => void,
  ) {
    new Groups(store, catalog);
    store.db.exec(
      'CREATE TABLE IF NOT EXISTS project_profiles(project_id TEXT PRIMARY KEY REFERENCES projects(id),cover TEXT)',
    );
  }
  private project(id: string) {
    const p = this.catalog.list().find((p) => p.id === id);
    if (!p || !/^[a-f0-9-]{36}$/.test(id)) throw Error('專案不存在');
    return p;
  }
  async cover(id: string) {
    this.project(id);
    const row = this.store.db
      .prepare('SELECT cover FROM project_profiles WHERE project_id=?')
      .get(id) as { cover: string | null } | undefined;
    if (row?.cover)
      return decodePng(
        await readFile(await confined(await realpath(this.root), `projects/${id}/${row.cover}`)),
        '專案封面.png',
      );
    const assets = this.catalog.assets(id).filter((a) => !a.error);
    const a =
      assets.find((a) => a.path.startsWith('img/titles1/')) ||
      assets.find((a) => a.path.startsWith('img/pictures/')) ||
      assets[0];
    return a ? this.catalog.preview(a.id) : null;
  }
  async save(id: string, name: string, cover: Buffer | null | undefined) {
    this.project(id);
    this.operations.assertEditable(id);
    if (this.busy || this.catalog.progress.running) throw Error('另有操作正在執行');
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80)
      throw Error('專案名稱需為 1–80 字');
    this.busy = true;
    let created: string | undefined;
    try {
      const old = this.store.db
        .prepare('SELECT cover FROM project_profiles WHERE project_id=?')
        .get(id) as { cover: string | null } | undefined;
      let file = cover === undefined ? (old?.cover ?? null) : null;
      if (cover) {
        const checked = await decodePng(cover, '專案封面.png');
        const dir = await confined(await realpath(this.root), `projects/${id}`);
        file = `cover-${randomUUID()}.png`;
        created = join(dir, file);
        const handle = await open(created, 'wx');
        try {
          await handle.writeFile(cover);
          await handle.sync();
        } finally {
          await handle.close();
        }
        if ((await decodePng(await readFile(created), file)).sha256 !== checked.sha256)
          throw Error('封面保存驗證失敗');
      }
      this.store.db.transaction(() => {
        this.store.db.prepare('UPDATE projects SET name=? WHERE id=?').run(name.trim(), id);
        this.store.db
          .prepare(
            'INSERT INTO project_profiles VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET cover=excluded.cover',
          )
          .run(id, file);
      })();
      created = undefined;
      // An inaccessible obsolete cover remains owned by this project and is removed on deletion.
      if (old?.cover && old.cover !== file) {
        await confined(await realpath(this.root), `projects/${id}/${old.cover}`)
          .then((p) => unlink(p))
          .catch(() => {});
      }
      return this.project(id);
    } catch (e) {
      if (created) await unlink(created).catch(() => {});
      throw e;
    } finally {
      this.busy = false;
    }
  }
  async remove(id: string, confirmed: boolean, abandonRecovery: boolean) {
    this.project(id);
    if (confirmed !== true) throw Error('請確認永久刪除與失去還原能力');
    if (this.busy || this.operations.busy || this.catalog.progress.running)
      throw Error('請等候目前操作安全結束');
    if (
      this.operations
        .list(id)
        .some((o) => !['committed', 'recovered', 'cancelled'].includes(o.status)) &&
      abandonRecovery !== true
    )
      throw Error('此專案有未完成恢復，必須明確確認放棄恢復');
    this.busy = true;
    try {
      const root = await realpath(this.root);
      const rel = `projects/${id}`;
      let target: string | undefined;
      try {
        target = await confined(root, rel);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      const inspect = async (path: string): Promise<void> => {
        const st = await lstat(path);
        if (st.isSymbolicLink()) throw Error('清理範圍包含連結或接合點，禁止刪除');
        if (st.isDirectory())
          for (const entry of await readdir(path)) await inspect(join(path, entry));
      };
      if (target) await inspect(target);
      if (target) {
        const contains = (parent: string, child: string) => {
          const delta = relative(parent, child);
          return !isAbsolute(delta) && delta !== '..' && !delta.startsWith('..' + sep);
        };
        for (const p of this.catalog.list()) {
          const game = await realpath(p.root).catch(() => resolve(p.root));
          if (contains(target, game) || contains(game, target))
            throw Error('清理範圍與遊戲位置重疊，禁止刪除');
        }
      }
      // Persist intent first. Missing/partially removed files can be retried after a restart.
      this.store.db.prepare("UPDATE projects SET status='deleting' WHERE id=?").run(id);
      this.fault?.('files');
      if (target) await rm(await confined(root, rel), { recursive: true, force: true });
      this.fault?.('metadata');
      this.store.db.transaction(() => {
        for (const table of ['version_deletions', 'selections', 'versions'])
          this.store.db
            .prepare(
              `DELETE FROM ${table} WHERE asset_id IN (SELECT id FROM assets WHERE project_id=?)`,
            )
            .run(id);
        this.store.db
          .prepare(
            'DELETE FROM group_members WHERE asset_id IN (SELECT id FROM assets WHERE project_id=?)',
          )
          .run(id);
        for (const table of ['groups', 'operations', 'project_profiles', 'project_codecs'])
          this.store.db.prepare(`DELETE FROM ${table} WHERE project_id=?`).run(id);
        this.store.db.prepare('DELETE FROM projects WHERE id=?').run(id);
      })();
    } finally {
      this.busy = false;
    }
  }
}
