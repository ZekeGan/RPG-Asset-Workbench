import { randomUUID, createHash } from 'node:crypto';
import { mkdir, open, readFile, unlink, realpath } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { pngPath } from './codec';
import { Store } from './store';
import { Catalog, confined, stableRead } from './catalog';
import { decodePng } from './png';
import type { Asset, Preview, Version, VersionState } from '../shared/contracts';
const digest = (b: Buffer) => createHash('sha256').update(b).digest('hex');
export class Versions {
  private busy = false;
  constructor(
    private store: Store,
    private catalog: Catalog,
    private root: string,
  ) {
    store.db
      .exec(`CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES assets(id),number INTEGER NOT NULL,hash TEXT NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,alpha INTEGER NOT NULL,name TEXT NOT NULL,created TEXT NOT NULL,differences TEXT NOT NULL,UNIQUE(asset_id,number));
   CREATE TABLE IF NOT EXISTS version_deletions(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS selections(asset_id TEXT PRIMARY KEY REFERENCES assets(id),active TEXT,deployed TEXT,next_number INTEGER NOT NULL DEFAULT 1);`);
  }
  asset(id: unknown) {
    if (typeof id !== 'string') throw Error('素材 ID 無效');
    const a = this.store.db
      .prepare(
        'SELECT id,project_id AS projectId,path,hash,width,height,alpha,error FROM assets WHERE id=?',
      )
      .get(id) as Asset | undefined;
    if (!a || a.error || !a.hash) throw Error('沒有可用的原始基準');
    return a;
  }
  state(id: unknown): VersionState {
    this.asset(id);
    const row = this.store.db
      .prepare('SELECT active,deployed FROM selections WHERE asset_id=?')
      .get(id) as { active: string | null; deployed: string | null } | undefined;
    return {
      active: row?.active ?? null,
      deployed: row?.deployed ?? null,
      versions: this.store.db
        .prepare(
          'SELECT id,asset_id AS assetId,number,hash,width,height,alpha,name,created,differences FROM versions WHERE asset_id=? ORDER BY number DESC',
        )
        .all(id) as Version[],
    };
  }
  async check(id: string, bytes: Buffer, name: string) {
    const a = this.asset(id);
    await this.catalog.preview(id);
    const preview = await decodePng(bytes, name),
      differences: string[] = [];
    if (a.width !== preview.width || a.height !== preview.height)
      differences.push(`尺寸：${a.width} × ${a.height} → ${preview.width} × ${preview.height}`);
    if (a.width! * preview.height !== preview.width * a.height!)
      differences.push(`比例：${a.width}:${a.height} → ${preview.width}:${preview.height}`);
    if (Boolean(a.alpha) !== preview.hasAlpha)
      differences.push(`透明通道：${a.alpha ? '有' : '無'} → ${preview.hasAlpha ? '有' : '無'}`);
    return { preview, differences };
  }
  async importBatch(items: { assetId: string; bytes: Buffer; name: string; accepted: boolean }[]) {
    if (this.busy) throw Error('版本正在保存');
    if (!items.length || new Set(items.map((i) => i.assetId)).size !== items.length)
      throw Error('空批次或重複目標');
    this.busy = true;
    const created: string[] = [];
    try {
      const staged: {
        asset: Asset;
        preview: Preview;
        differences: string[];
        id: string;
        name: string;
      }[] = [];
      for (const i of items) {
        const asset = this.asset(i.assetId),
          checked = await this.check(i.assetId, i.bytes, i.name);
        if (checked.differences.length && i.accepted !== true) throw Error('必須接受圖片差異');
        const id = randomUUID();
        const parent = await confined(await realpath(this.root), 'projects/' + asset.projectId);
        await mkdir(join(parent, 'versions'), { recursive: true });
        const dir = await confined(
          await realpath(this.root),
          'projects/' + asset.projectId + '/versions',
        );
        const path = join(dir, id + '.png');
        const f = await open(path, 'wx');
        created.push(path);
        try {
          await f.writeFile(i.bytes);
          await f.sync();
        } finally {
          await f.close();
        }
        if (digest(await readFile(path)) !== checked.preview.sha256)
          throw Error('版本檔案驗證失敗');
        staged.push({ asset, ...checked, id, name: basename(i.name) });
      }
      this.store.db.transaction(() => {
        for (const s of staged) {
          this.store.db
            .prepare('INSERT OR IGNORE INTO selections(asset_id) VALUES(?)')
            .run(s.asset.id);
          const { next_number: n } = this.store.db
            .prepare('SELECT next_number FROM selections WHERE asset_id=?')
            .get(s.asset.id) as { next_number: number };
          this.store.db
            .prepare('INSERT INTO versions VALUES(?,?,?,?,?,?,?,?,?,?)')
            .run(
              s.id,
              s.asset.id,
              n,
              s.preview.sha256,
              s.preview.width,
              s.preview.height,
              Number(s.preview.hasAlpha),
              s.name,
              new Date().toISOString(),
              JSON.stringify(s.differences),
            );
          this.store.db
            .prepare('UPDATE selections SET active=?,next_number=? WHERE asset_id=?')
            .run(s.id, n + 1, s.asset.id);
        }
      })();
      return staged.map((s) => this.state(s.asset.id));
    } catch (e) {
      for (const p of created) await unlink(p).catch(() => {});
      throw e;
    } finally {
      this.busy = false;
    }
  }
  async bytes(id: string, versionId: string | null) {
    const a = this.asset(id);
    let hash = a.hash!,
      rel = `projects/${a.projectId}/originals/${a.id}.png`;
    if (versionId !== null) {
      const v = this.state(id).versions.find((v) => v.id === versionId);
      if (!v) throw Error('版本不屬於此素材');
      hash = v.hash;
      rel = `projects/${a.projectId}/versions/${v.id}.png`;
    }
    const b = await stableRead(await confined(await realpath(this.root), rel));
    if (digest(b) !== hash) throw Error('圖片備份損壞，禁止使用');
    return versionId === null ? this.catalog.decode(a.projectId, a.path, b) : b;
  }
  async gameBytes(id: string, versionId: string | null) {
    const a = this.asset(id);
    if (versionId !== null)
      return this.catalog.encode(a.projectId, a.path, await this.bytes(id, versionId));
    const raw = await stableRead(
      await confined(await realpath(this.root), `projects/${a.projectId}/originals/${a.id}.png`),
    );
    if (digest(raw) !== a.hash) throw Error('原始備份損壞');
    return raw;
  }
  async preview(id: string, versionId: string | null) {
    return decodePng(await this.bytes(id, versionId), pngPath(this.asset(id).path));
  }
  async select(id: string, versionId: string | null) {
    if (this.busy) throw Error('版本正在保存');
    this.busy = true;
    try {
      if (versionId !== null) {
        if (this.store.db.prepare('SELECT id FROM version_deletions WHERE id=?').get(versionId))
          throw Error('此版本刪除尚未完成，請重試刪除');
        await this.bytes(id, versionId);
      } else this.asset(id);
      this.store.db.prepare('INSERT OR IGNORE INTO selections(asset_id) VALUES(?)').run(id);
      this.store.db.prepare('UPDATE selections SET active=? WHERE asset_id=?').run(versionId, id);
      return this.state(id);
    } finally {
      this.busy = false;
    }
  }
  async remove(id: string, versionId: string) {
    if (this.busy) throw Error('版本正在保存');
    this.busy = true;
    try {
      const state = this.state(id);
      if (state.active === versionId || state.deployed === versionId)
        throw Error('不可刪除目前選用或已部署版本');
      const v = state.versions.find((v) => v.id === versionId);
      if (!v) throw Error('版本不存在');
      const a = this.asset(id);
      const dir = await confined(await realpath(this.root), `projects/${a.projectId}/versions`);
      const path = join(dir, v.id + '.png');
      // Persist deletion intent before removing bytes. Failed cleanup remains retryable.
      this.store.db
        .prepare('INSERT OR IGNORE INTO version_deletions(id,asset_id) VALUES(?,?)')
        .run(v.id, id);
      await unlink(path).catch((e) => {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      });
      this.store.db.transaction(() => {
        this.store.db.prepare('DELETE FROM versions WHERE id=? AND asset_id=?').run(versionId, id);
        this.store.db.prepare('DELETE FROM version_deletions WHERE id=?').run(versionId);
      })();
      return this.state(id);
    } finally {
      this.busy = false;
    }
  }
}
