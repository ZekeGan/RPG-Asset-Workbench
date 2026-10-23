import { afterEach, describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { Store } from '../src/main/store';
import { Catalog, confined, detectGame } from '../src/main/catalog';
const dirs: string[] = [];
const stores: Store[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function fixture(engine: 'MV' | 'MZ' = 'MV', wrapped = false) {
  const root = await mkdtemp(join(tmpdir(), 'rpg-catalog-'));
  dirs.push(root);
  const selected = join(root, 'game'),
    game = wrapped ? join(selected, 'www') : selected,
    data = join(root, 'tool');
  for (const dir of ['js', 'data', 'img/pictures', 'img/faces'])
    await mkdir(join(game, dir), { recursive: true });
  await mkdir(data);
  await writeFile(
    join(game, 'js', engine === 'MV' ? 'rpg_core.js' : 'rmmz_core.js'),
    `Utils.RPGMAKER_NAME = '${engine}';\nthrow Error('must never execute');`,
  );
  await writeFile(
    join(game, 'data/System.json'),
    JSON.stringify({ gameTitle: '測試遊戲', hasEncryptedImages: false }),
  );
  const bytes = await sharp({ create: { width: 4, height: 3, channels: 4, background: '#c0ffee' } })
    .png()
    .toBuffer();
  await writeFile(join(game, 'img/pictures/same.png'), bytes);
  await writeFile(join(game, 'img/faces/same.png'), bytes);
  const store = new Store(join(data, 'catalog.sqlite'));
  stores.push(store);
  const catalog = new Catalog(store, data);
  return { root, selected, game, data, bytes, store, catalog };
}
describe('read-only catalog and immutable baseline', () => {
  it.each([
    ['MV', false],
    ['MV', true],
    ['MZ', false],
    ['MZ', true],
  ] as const)('identifies %s wrapped=%s without executing game code', async (engine, wrapped) => {
    const f = await fixture(engine, wrapped);
    expect((await detectGame(f.selected)).engine).toBe(engine);
    const p = await f.catalog.create(f.selected, '專案', true);
    const rows = f.catalog.assets(p.id);
    expect(p.status).toBe('ready');
    expect(rows).toHaveLength(2);
    expect(rows.map((a) => a.path)).toEqual(['img/faces/same.png', 'img/pictures/same.png']);
    for (const row of rows) {
      expect(await readFile(join(f.game, row.path))).toEqual(f.bytes);
      expect(await readFile(join(f.data, 'projects', p.id, 'originals', row.id + '.png'))).toEqual(
        f.bytes,
      );
    }
  });
  it('blocks duplicate canonical locations and retains original after external source changes', async () => {
    const f = await fixture('MV', true);
    const p = await f.catalog.create(f.selected, '', true);
    await expect(f.catalog.create(f.game, 'duplicate', true)).rejects.toThrow('已有專案');
    const a = f.catalog.assets(p.id)[0];
    await writeFile(join(f.game, a.path), 'external change');
    expect((await f.catalog.preview(a.id)).sha256).toBe(a.hash);
  });
  it('records invalid PNG individually while preserving good assets', async () => {
    const f = await fixture();
    await writeFile(join(f.game, 'img/pictures/bad.png'), 'broken');
    const p = await f.catalog.create(f.selected, '', true);
    expect(p.status).toBe('warnings');
    expect(f.catalog.assets(p.id).filter((a) => a.error)).toHaveLength(1);
    expect(f.catalog.assets(p.id).filter((a) => a.hash)).toHaveLength(2);
  });
  it('rejects unconfirmed sources and encrypted projects explicitly', async () => {
    const f = await fixture();
    await expect(f.catalog.create(f.selected, '', false)).rejects.toThrow('確認');
    await writeFile(join(f.game, 'data/System.json'), JSON.stringify({ hasEncryptedImages: true }));
    await expect(f.catalog.create(f.selected, '', true)).rejects.toThrow('加密');
    expect(f.catalog.list()).toHaveLength(0);
  });
  it('rejects traversal and skips links to external assets', async () => {
    const f = await fixture();
    await expect(confined(f.game, '../tool')).rejects.toThrow('不合法');
    await symlink(join(f.game, 'img/faces'), join(f.game, 'img/link'), 'junction');
    const p = await f.catalog.create(f.selected, '', true);
    expect(f.catalog.assets(p.id).find((a) => a.path === 'img/link')?.error).toContain('連結');
    expect(f.catalog.assets(p.id).filter((a) => a.hash)).toHaveLength(2);
  });
  it('detects backup tampering instead of showing it as original', async () => {
    const f = await fixture();
    const p = await f.catalog.create(f.selected, '', true),
      a = f.catalog.assets(p.id)[0];
    await writeFile(join(f.data, 'projects', p.id, 'originals', a.id + '.png'), 'tampered');
    await expect(f.catalog.preview(a.id)).rejects.toThrow('備份損壞');
  });
  it('reloads project and assets from disk and marks unfinished scan interrupted', async () => {
    const f = await fixture();
    const p = await f.catalog.create(f.selected, '', true);
    f.store.db.prepare("UPDATE projects SET status='scanning' WHERE id=?").run(p.id);
    f.store.close();
    stores.splice(stores.indexOf(f.store), 1);
    const reopened = new Store(join(f.data, 'catalog.sqlite'));
    stores.push(reopened);
    const catalog = new Catalog(reopened, f.data);
    expect(catalog.list()[0].status).toBe('interrupted');
    expect(catalog.assets(p.id)).toHaveLength(2);
  });
  it('keeps two projects isolated', async () => {
    const f = await fixture(),
      g = await fixture('MZ');
    const a = await f.catalog.create(f.selected, 'A', true),
      b = await f.catalog.create(g.selected, 'B', true);
    expect(f.catalog.assets(a.id).map((x) => x.id)).not.toEqual(
      f.catalog.assets(b.id).map((x) => x.id),
    );
    expect(f.catalog.list()).toHaveLength(2);
  });
  it('stops safely after cancellation and records partial result', async () => {
    const f = await fixture();
    for (let i = 0; i < 12; i++) await writeFile(join(f.game, 'img/pictures', i + '.png'), f.bytes);
    const timer = setInterval(() => {
      if (f.catalog.progress.processed >= 1) f.catalog.cancel();
    }, 1);
    try {
      const p = await f.catalog.create(f.selected, '', true);
      expect(p.status).toBe('cancelled');
      expect(f.catalog.assets(p.id).length).toBeLessThan(14);
      expect(f.catalog.progress.running).toBe(false);
      clearInterval(timer);
      const saved = f.catalog.assets(p.id);
      const reopened = new Catalog(f.store, f.data);
      const plan = await reopened.scanPlan(p.id);
      expect(plan.added.length).toBe(14 - saved.length);
      const resumed = await reopened.scanCommit(p.id, plan.token);
      expect(resumed.status).toBe('ready');
      expect(reopened.assets(p.id)).toHaveLength(14);
      for (const asset of saved)
        expect(reopened.assets(p.id).find((a) => a.id === asset.id)).toEqual(asset);
    } finally {
      clearInterval(timer);
    }
  });
});
