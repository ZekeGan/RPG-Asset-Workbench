import { lstat, mkdir, realpath, open, rename, unlink, readFile, link } from 'node:fs/promises';
import { join, relative, isAbsolute, sep, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pngPath } from './codec';
import { Versions } from './versions';
import { Catalog } from './catalog';
import type { ExportResult } from '../shared/contracts';
const inside = (a: string, b: string) => {
  const d = relative(a, b);
  return !d || (!d.startsWith('..' + sep) && d !== '..' && !isAbsolute(d));
};
async function exists(p: string) {
  try {
    return await lstat(p);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}
async function destination(root: string, rel: string, create = false) {
  if (
    isAbsolute(rel) ||
    rel.split(/[\\/]/).some((p) => !p || p === '..' || p === '.' || p.includes(':'))
  )
    throw Error('匯出路徑不合法');
  let p = root;
  const parts = rel.split('/');
  for (let i = 0; i < parts.length; i++) {
    p = join(p, parts[i]);
    let stat = await exists(p);
    if (!stat && i < parts.length - 1 && create) {
      await mkdir(p);
      stat = await lstat(p);
    }
    if (stat?.isSymbolicLink()) throw Error('目的地含符號連結／接合點');
    if (stat && i < parts.length - 1 && !stat.isDirectory()) throw Error('目的地不是資料夾');
    if (stat && i === parts.length - 1 && !stat.isFile()) throw Error('目的地不是一般檔案');
  }
  return p;
}
export class Exporter {
  constructor(
    private versions: Versions,
    private catalog: Catalog,
    private dataRoot: string,
  ) {}
  async prepare(ids: string[], source: 'original' | 'active', selected: string) {
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 10000 ||
      ids.some((id) => typeof id !== 'string') ||
      new Set(ids).size !== ids.length ||
      !['original', 'active'].includes(source)
    )
      throw Error('匯出選擇無效');
    const root = await realpath(selected),
      protectedRoots = [await realpath(this.dataRoot), ...this.catalog.list().map((p) => p.root)];
    for (const p of protectedRoots)
      if (inside(p, root) || inside(root, p)) throw Error('匯出位置不可與遊戲或工具資料重疊');
    const items = ids.map((id) => {
      const a = this.versions.asset(id);
      return {
        id,
        path: pngPath(a.path),
        version: source === 'active' ? this.versions.state(id).active : null,
      };
    });
    if (new Set(items.map((i) => i.path.toLowerCase())).size !== items.length)
      throw Error('匯出路徑重複，請分開專案匯出');
    const conflicts: string[] = [];
    for (const i of items)
      if (await exists(await destination(root, i.path))) conflicts.push(i.path);
    return { root, items, conflicts };
  }
  async run(
    plan: Awaited<ReturnType<Exporter['prepare']>>,
    policy: 'skip' | 'overwrite' | 'cancel',
  ): Promise<ExportResult> {
    const result: ExportResult = { completed: [], skipped: [], failed: [] };
    if (policy === 'cancel') {
      result.skipped = plan.items.map((i) => i.path);
      return result;
    }
    for (const i of plan.items) {
      let temp: string | undefined;
      try {
        const bytes = await this.versions.bytes(i.id, i.version);
        const target = await destination(plan.root, i.path, true),
          existing = await exists(target);
        if (existing && policy === 'skip') {
          result.skipped.push(i.path);
          continue;
        }
        if (existing && !plan.conflicts.includes(i.path))
          throw Error('預檢後出現同名檔案，未授權覆蓋');
        temp = join(dirname(target), '.rpg-export-' + randomUUID());
        const f = await open(temp, 'wx');
        try {
          await f.writeFile(bytes);
          await f.sync();
        } finally {
          await f.close();
        }
        await destination(plan.root, i.path);
        if (existing) {
          await rename(temp, target);
          temp = undefined;
        } else {
          await link(temp, target);
          await unlink(temp);
          temp = undefined;
        }
        if (!(await readFile(target)).equals(bytes)) throw Error('匯出後驗證失敗');
        result.completed.push(i.path);
      } catch (e) {
        result.failed.push({ path: i.path, error: e instanceof Error ? e.message : String(e) });
      } finally {
        if (temp) await unlink(temp).catch(() => {});
      }
    }
    return result;
  }
}
