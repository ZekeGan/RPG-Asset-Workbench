import { it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { Store } from '../src/main/store';
import { Catalog } from '../src/main/catalog';
import { Versions } from '../src/main/versions';
import { Groups } from '../src/main/groups';
import { BatchImports } from '../src/main/batch';
const dirs: string[] = [],
  stores: Store[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'manager04-'));
  dirs.push(root);
  const game = join(root, 'game'),
    data = join(root, 'tool');
  for (const d of [
    data,
    join(game, 'js'),
    join(game, 'data'),
    join(game, 'img/pictures'),
    join(game, 'img/faces'),
  ])
    await mkdir(d, { recursive: true });
  await writeFile(join(game, 'js/rmmz_core.js'), "Utils.RPGMAKER_NAME = 'MZ'");
  await writeFile(join(game, 'data/System.json'), '{}');
  const bytes = await sharp({ create: { width: 12, height: 8, channels: 4, background: 'red' } })
    .png()
    .toBuffer();
  await writeFile(join(game, 'img/pictures/a.png'), bytes);
  await writeFile(join(game, 'img/faces/a.png'), bytes);
  const store = new Store(join(data, 'catalog.sqlite'));
  stores.push(store);
  const catalog = new Catalog(store, data),
    p = await catalog.create(game, 'test', true),
    versions = new Versions(store, catalog, data);
  return {
    root,
    game,
    data,
    bytes,
    store,
    catalog,
    p,
    versions,
    assets: catalog.assets(p.id),
    groups: new Groups(store, catalog),
    batch: new BatchImports(catalog, versions),
  };
}
it('keeps one asset in multiple groups and removes associations without deleting bytes or history', async () => {
  const f = await fixture(),
    id = f.assets[0].id;
  const a = f.groups.create(f.p.id, 'A')[0],
    b = f.groups.create(f.p.id, 'B').find((g) => g.name === 'B')!;
  f.groups.change(f.p.id, a.id, 'add', [id]);
  f.groups.change(f.p.id, b.id, 'add', [id]);
  await f.versions.importBatch([{ assetId: id, bytes: f.bytes, name: 'a.png', accepted: true }]);
  f.groups.change(f.p.id, a.id, 'remove', [id]);
  expect(f.groups.list(f.p.id).find((g) => g.id === b.id)?.assetIds).toEqual([id]);
  f.groups.change(f.p.id, b.id, 'delete');
  expect(f.catalog.assets(f.p.id)).toHaveLength(2);
  expect(f.versions.state(id).versions).toHaveLength(1);
  expect(await readFile(join(f.game, f.assets[0].path))).toEqual(f.bytes);
});
it('rejects cross-project group members and persists group membership', async () => {
  const f = await fixture(),
    g = await fixture();
  const other = await f.catalog.create(g.game, 'other', true);
  const group = f.groups.create(f.p.id, 'A')[0];
  expect(() =>
    f.groups.change(f.p.id, group.id, 'add', [f.catalog.assets(other.id)[0].id]),
  ).toThrow('不屬於');
  f.groups.change(f.p.id, group.id, 'add', [f.assets[0].id]);
  expect(new Groups(f.store, f.catalog).list(f.p.id)[0].assetIds).toEqual([f.assets[0].id]);
});
it('pairs only exact relative paths and leaves same basename ambiguous for manual mapping', async () => {
  const f = await fixture(),
    input = join(f.root, 'input');
  await mkdir(join(input, 'img/pictures'), { recursive: true });
  await writeFile(join(input, 'img/pictures/a.png'), f.bytes);
  await writeFile(join(input, 'a.png'), f.bytes);
  const files = await f.batch.choose(f.p.id, input);
  expect(files.find((x) => x.path === 'a.png')?.assetId).toBeNull();
  expect(files.find((x) => x.path === 'img/pictures/a.png')?.assetId).toBe(
    f.assets.find((a) => a.path === 'img/pictures/a.png')?.id,
  );
});
it('commits a batch atomically and detects source changes since inspection', async () => {
  const f = await fixture(),
    input = join(f.root, 'input');
  await cp(join(f.game, 'img'), join(input, 'img'), { recursive: true });
  let files = await f.batch.choose(f.p.id, input);
  await f.batch.commit(
    f.p.id,
    files.map((x) => ({ token: x.token, assetId: x.assetId!, accepted: true })),
  );
  for (const a of f.assets) expect(f.versions.state(a.id).versions).toHaveLength(1);
  files = await f.batch.choose(f.p.id, input);
  await writeFile(join(input, files[0].path), 'modified');
  await expect(
    f.batch.commit(
      f.p.id,
      files.map((x) => ({ token: x.token, assetId: x.assetId!, accepted: true })),
    ),
  ).rejects.toThrow();
  for (const a of f.assets) expect(f.versions.state(a.id).versions).toHaveLength(1);
});
it('rejects duplicate batch targets without visible partial versions', async () => {
  const f = await fixture(),
    input = join(f.root, 'input');
  await cp(join(f.game, 'img'), join(input, 'img'), { recursive: true });
  const files = await f.batch.choose(f.p.id, input);
  await expect(
    f.batch.commit(
      f.p.id,
      files.map((x) => ({ token: x.token, assetId: f.assets[0].id, accepted: true })),
    ),
  ).rejects.toThrow('重複');
  expect(f.versions.state(f.assets[0].id).versions).toHaveLength(0);
});
it('relinks an identical moved copy without changing baseline or version and rejects changed content', async () => {
  const f = await fixture(),
    copy = join(f.root, 'moved');
  await cp(f.game, copy, { recursive: true });
  const before = f.catalog.assets(f.p.id);
  await f.catalog.relink(f.p.id, copy);
  expect(f.catalog.list()[0].root).toBe(copy);
  expect(f.catalog.assets(f.p.id)).toEqual(before);
  await writeFile(join(f.game, f.assets[0].path), 'different');
  await expect(f.catalog.relink(f.p.id, f.game)).rejects.toThrow('不一致');
  expect(f.catalog.list()[0].root).toBe(copy);
});
it('relink rejects extra assets and duplicate project destinations', async () => {
  const f = await fixture(),
    copy = join(f.root, 'copy');
  await cp(f.game, copy, { recursive: true });
  await writeFile(join(copy, 'img/pictures/new.png'), f.bytes);
  await expect(f.catalog.relink(f.p.id, copy)).rejects.toThrow('清單');
  await f.catalog.create(copy, 'another', true);
  await expect(f.catalog.relink(f.p.id, copy)).rejects.toThrow('其他專案');
});
import { WriteGuard } from '../src/main/write-guard';
it('storage failure blocks writes across restart until a real DB and disk probe succeeds', async () => {
  const f = await fixture(),
    guard = new WriteGuard(f.data);
  guard.record(Object.assign(new Error('disk full'), { code: 'ENOSPC' }));
  expect(() => guard.assertWritable()).toThrow('儲存故障');
  const reopened = new WriteGuard(f.data);
  expect(reopened.status().blocked).toBe(true);
  await reopened.retry(f.store);
  expect(reopened.status().blocked).toBe(false);
  expect(new WriteGuard(f.data).status().blocked).toBe(false);
});
it('validation errors do not falsely mark storage failed', async () => {
  const f = await fixture(),
    guard = new WriteGuard(f.data);
  guard.record(new Error('wrong png'));
  expect(guard.status().blocked).toBe(false);
});
import { ProjectDeletion } from '../src/main/deletion';
import { Operations } from '../src/main/operations';
it('deletes only project-owned data after confirmation and preserves another project and game', async () => {
  const f = await fixture(),
    g = await fixture();
  new Operations(f.store, f.catalog, f.versions, f.data);
  const other = await f.catalog.create(g.game, 'other', true),
    deletion = new ProjectDeletion(f.store, f.catalog, f.data);
  await expect(deletion.remove(f.p.id, false, false)).rejects.toThrow('確認');
  await deletion.remove(f.p.id, true, false);
  expect(f.catalog.list().map((p) => p.id)).toEqual([other.id]);
  expect(await readFile(join(f.game, f.assets[0].path))).toEqual(f.bytes);
  expect(f.catalog.assets(other.id)).toHaveLength(2);
});
it('allows explicit abandonment of deployed results and preserves game bytes', async () => {
  const f = await fixture(),
    ops = new Operations(f.store, f.catalog, f.versions, f.data),
    a = f.assets[0],
    edit = await sharp(f.bytes).negate().png().toBuffer();
  await f.versions.importBatch([{ assetId: a.id, bytes: edit, name: 'edit.png', accepted: true }]);
  await ops.execute(f.p.id, 'apply');
  const deletion = new ProjectDeletion(f.store, f.catalog, f.data);
  await expect(deletion.remove(f.p.id, true, false)).rejects.toThrow('再次確認');
  await deletion.remove(f.p.id, true, true);
  expect(await readFile(join(f.game, a.path))).toEqual(edit);
  expect(f.catalog.list()).toHaveLength(0);
});
it('retains a failed deletion job and resumes only the same owned project', async () => {
  const f = await fixture();
  new Operations(f.store, f.catalog, f.versions, f.data);
  let n = 0;
  const deletion = new ProjectDeletion(f.store, f.catalog, f.data, () => {
    if (++n === 2) throw Error('injected cleanup failure');
  });
  await expect(deletion.remove(f.p.id, true, false)).rejects.toThrow('injected');
  expect(
    (f.store.db.prepare('SELECT status FROM deletion_jobs').get() as { status: string }).status,
  ).toBe('failed');
  expect(f.catalog.list()).toHaveLength(1);
  await new ProjectDeletion(f.store, f.catalog, f.data).remove(f.p.id, true, false);
  expect(f.catalog.list()).toHaveLength(0);
  expect(await readFile(join(f.game, f.assets[0].path))).toEqual(f.bytes);
});

import { ProjectDrafts } from '../src/main/project-drafts';
it('creation preview exposes no key, is single-use, and rejects changed game settings', async () => {
  const f = await fixture(),
    drafts = new ProjectDrafts();
  const preview = await drafts.choose(f.game);
  expect(preview).toMatchObject({ engine: 'MZ', encrypted: false, root: f.game });
  expect(preview).not.toHaveProperty('encryptionKey');
  expect(await drafts.consume(preview.token)).toBe(f.game);
  await expect(drafts.consume(preview.token)).rejects.toThrow('過期');
  const stale = await drafts.choose(f.game);
  await writeFile(join(f.game, 'data/System.json'), JSON.stringify({ gameTitle: 'changed' }));
  await expect(drafts.consume(stale.token)).rejects.toThrow('設定已變更');
});
it('reselecting or cancelling invalidates previous creation paths', async () => {
  const f = await fixture(),
    drafts = new ProjectDrafts();
  const first = await drafts.choose(f.game);
  await drafts.choose(f.game);
  await expect(drafts.consume(first.token)).rejects.toThrow('過期');
  const next = await drafts.choose(f.game);
  drafts.clear();
  await expect(drafts.consume(next.token)).rejects.toThrow('過期');
  await expect(drafts.consume(f.game)).rejects.toThrow('過期');
});
