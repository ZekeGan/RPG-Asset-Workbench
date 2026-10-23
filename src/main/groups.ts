import { randomUUID } from 'node:crypto';
import { Store } from './store';
import { Catalog } from './catalog';
import type { Group } from '../shared/contracts';
export class Groups {
  constructor(
    private store: Store,
    private catalog: Catalog,
  ) {
    store.db.exec(
      `CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,UNIQUE(project_id,name));CREATE TABLE IF NOT EXISTS group_members(group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,asset_id TEXT NOT NULL REFERENCES assets(id),PRIMARY KEY(group_id,asset_id));`,
    );
  }
  list(projectId: string): Group[] {
    this.catalog.assets(projectId);
    return (
      this.store.db
        .prepare('SELECT id,name FROM groups WHERE project_id=? ORDER BY name')
        .all(projectId) as { id: string; name: string }[]
    ).map((g) => ({
      ...g,
      projectId,
      assetIds: (
        this.store.db.prepare('SELECT asset_id FROM group_members WHERE group_id=?').all(g.id) as {
          asset_id: string;
        }[]
      ).map((a) => a.asset_id),
    }));
  }
  create(projectId: string, name: string) {
    this.catalog.assets(projectId);
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80)
      throw Error('群組名稱需為 1–80 字');
    this.store.db
      .prepare('INSERT INTO groups VALUES(?,?,?)')
      .run(randomUUID(), projectId, name.trim());
    return this.list(projectId);
  }
  change(projectId: string, id: string, action: 'add' | 'remove' | 'delete', ids: string[] = []) {
    if (!this.list(projectId).some((g) => g.id === id)) throw Error('群組不屬於此專案');
    if (
      !['add', 'remove', 'delete'].includes(action) ||
      !Array.isArray(ids) ||
      ids.some((x) => typeof x !== 'string')
    )
      throw Error('群組參數無效');
    const valid = new Set(this.catalog.assets(projectId).map((a) => a.id));
    if (ids.some((id) => !valid.has(id))) throw Error('素材不屬於此專案');
    this.store.db.transaction(() => {
      if (action === 'delete') {
        this.store.db.prepare('DELETE FROM groups WHERE id=?').run(id);
        return;
      }
      for (const asset of ids)
        this.store.db
          .prepare(
            action === 'add'
              ? 'INSERT OR IGNORE INTO group_members VALUES(?,?)'
              : 'DELETE FROM group_members WHERE group_id=? AND asset_id=?',
          )
          .run(id, asset);
    })();
    return this.list(projectId);
  }
}
