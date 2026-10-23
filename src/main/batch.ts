import { readdir, realpath } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pngPath } from './codec';
import { Catalog, confined, stableRead } from './catalog';
import { Versions } from './versions';
import { decodePng } from './png';
import type { BatchFile } from '../shared/contracts';
export class BatchImports {
  private files = new Map<
    string,
    { projectId: string; root: string; path: string; hash: string | null }
  >();
  constructor(
    private catalog: Catalog,
    private versions: Versions,
  ) {}
  clear() {
    this.files.clear();
  }
  async choose(projectId: string, selected: string) {
    this.clear();
    const assets = this.catalog.assets(projectId),
      root = await realpath(selected),
      files: BatchFile[] = [];
    const walk = async (rel: string) => {
      const dir = rel ? await confined(root, rel) : root;
      for (const e of await readdir(dir, { withFileTypes: true })) {
        if (e.isSymbolicLink()) continue;
        const path = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) {
          await walk(path);
          continue;
        }
        if (!e.isFile()) continue;
        if (!/\.(png|jpe?g|webp|gif|apng)$/i.test(e.name)) continue;
        if (files.length >= 2000) throw Error('單批最多 2000 張，請分批匯入');
        let hash: string | null = null,
          error: string | null = null;
        try {
          hash = (await decodePng(await stableRead(await confined(root, path)), e.name)).sha256;
        } catch (err) {
          error = String(err);
        }
        const matches = assets.filter((a) => pngPath(a.path) === path);
        const token = randomUUID();
        this.files.set(token, { projectId, root, path, hash });
        files.push({
          token,
          path,
          name: e.name,
          assetId: matches.length === 1 ? matches[0].id : null,
          error,
        });
      }
    };
    await walk('');
    return files;
  }
  private async read(token: string) {
    const f = this.files.get(token);
    if (!f) throw Error('批次已過期');
    const bytes = await stableRead(await confined(f.root, f.path));
    const preview = await decodePng(bytes, basename(f.path));
    if (preview.sha256 !== f.hash) throw Error('來源自預檢後已改變，請重新載入');
    return { ...f, bytes, name: basename(f.path) };
  }
  async inspect(token: string, assetId: string) {
    const f = await this.read(token);
    if (this.versions.asset(assetId).projectId !== f.projectId) throw Error('跨專案配對遭拒');
    return { token, ...(await this.versions.check(assetId, f.bytes, f.name)) };
  }
  async commit(projectId: string, items: { token: string; assetId: string; accepted: boolean }[]) {
    if (!Array.isArray(items) || !items.length || items.length > 2000) throw Error('批次清單無效');
    const prepared = [];
    let total = 0;
    if (new Set(items.map((i) => i.token)).size !== items.length) throw Error('來源重複');
    for (const i of items) {
      if (
        typeof i.token !== 'string' ||
        typeof i.assetId !== 'string' ||
        typeof i.accepted !== 'boolean'
      )
        throw Error('配對無效');
      const f = await this.read(i.token);
      if (f.projectId !== projectId || this.versions.asset(i.assetId).projectId !== projectId)
        throw Error('跨專案配對遭拒');
      total += f.bytes.length;
      if (total > 128 * 1024 * 1024) throw Error('單批圖片總量超過 128 MiB，請分批');
      prepared.push({ assetId: i.assetId, bytes: f.bytes, name: f.name, accepted: i.accepted });
    }
    await this.versions.importBatch(prepared);
    this.clear();
  }
}
