import { lstat, readdir, unlink, rmdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { Store } from './store';
import { Catalog, confined } from './catalog';
export class ProjectDeletion {
  busy = false;
  constructor(
    private store: Store,
    private catalog: Catalog,
    private root: string,
    private fault?: (path: string) => void,
  ) {
    store.db.exec(
      'CREATE TABLE IF NOT EXISTS deletion_jobs(project_id TEXT PRIMARY KEY,name TEXT NOT NULL,status TEXT NOT NULL,error TEXT)',
    );
  }
  risk(projectId: string) {
    const p = this.catalog.list().find((p) => p.id === projectId);
    if (!p) throw Error('專案不存在');
    const deployed = !!this.store.db
      .prepare(
        'SELECT s.asset_id FROM selections s JOIN assets a ON a.id=s.asset_id WHERE a.project_id=? AND s.deployed IS NOT NULL LIMIT 1',
      )
      .get(projectId);
    const recovery = !!this.store.db
      .prepare(
        "SELECT id FROM operations WHERE project_id=? AND status NOT IN ('committed','recovered','cancelled') LIMIT 1",
      )
      .get(projectId);
    return { project: p, deployed, recovery };
  }
  async remove(projectId: string, confirmed: boolean, abandon: boolean) {
    if (this.busy) throw Error('刪除正在進行');
    const risk = this.risk(projectId);
    if (confirmed !== true) throw Error('需要確認永久刪除專案');
    if ((risk.deployed || risk.recovery) && abandon !== true)
      throw Error('需再次確認保留遊戲現況並永久放棄還原／恢復能力');
    this.busy = true;
    try {
      this.store.db
        .prepare(
          "INSERT INTO deletion_jobs VALUES(?,?,'deleting',NULL) ON CONFLICT(project_id) DO UPDATE SET status='deleting',error=NULL",
        )
        .run(projectId, risk.project.name);
      const base = await realpath(this.root),
        parent = await confined(base, 'projects'),
        path = join(parent, projectId);
      if (!/^[a-f\d-]{36}$/i.test(projectId)) throw Error('專案目錄識別無效');
      const removeTree = async (p: string): Promise<void> => {
        let stat;
        try {
          stat = await lstat(p);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
          throw e;
        }
        if (stat.isSymbolicLink()) throw Error('專案資料含連結，停止清理');
        if (stat.isDirectory()) {
          for (const e of await readdir(p)) {
            await removeTree(join(p, e));
          }
          await rmdir(p);
        } else {
          this.fault?.(p);
          await unlink(p);
        }
      };
      await removeTree(path);
      this.store.db.transaction(() => {
        this.store.db
          .prepare(
            'DELETE FROM group_members WHERE group_id IN (SELECT id FROM groups WHERE project_id=?)',
          )
          .run(projectId);
        this.store.db.prepare('DELETE FROM groups WHERE project_id=?').run(projectId);
        this.store.db
          .prepare(
            'DELETE FROM version_deletions WHERE asset_id IN (SELECT id FROM assets WHERE project_id=?)',
          )
          .run(projectId);
        this.store.db
          .prepare(
            'DELETE FROM selections WHERE asset_id IN (SELECT id FROM assets WHERE project_id=?)',
          )
          .run(projectId);
        this.store.db
          .prepare(
            'DELETE FROM versions WHERE asset_id IN (SELECT id FROM assets WHERE project_id=?)',
          )
          .run(projectId);
        this.store.db.prepare('DELETE FROM operations WHERE project_id=?').run(projectId);
        this.store.db.prepare('DELETE FROM project_codecs WHERE project_id=?').run(projectId);
        this.store.db.prepare('DELETE FROM assets WHERE project_id=?').run(projectId);
        this.store.db.prepare('DELETE FROM projects WHERE id=?').run(projectId);
        this.store.db.prepare('DELETE FROM deletion_jobs WHERE project_id=?').run(projectId);
      })();
    } catch (e) {
      this.store.db
        .prepare("UPDATE deletion_jobs SET status='failed',error=? WHERE project_id=?")
        .run(String(e), projectId);
      throw e;
    } finally {
      this.busy = false;
    }
  }
}
