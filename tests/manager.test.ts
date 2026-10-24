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
it('previews unmatched and ambiguous incoming images without selecting a target, rejecting changed sources', async () => {
  const f = await fixture(),
    file = join(f.root, 'unmatched.png');
  await writeFile(file, f.bytes);
  const [row] = await f.batch.chooseFiles(f.p.id, [file]);
  expect(row.assetId).toBeNull();
  expect((await f.batch.preview(row.token)).width).toBe(12);
  expect((await f.batch.preview(row.token, true)).dataUrl).toBe(
    'data:image/png;base64,' + f.bytes.toString('base64'),
  );
  expect(f.versions.state(f.assets[0].id).versions).toHaveLength(0);
  const ambiguous = join(f.root, 'a.png');
  await writeFile(ambiguous, f.bytes);
  const [second] = await f.batch.chooseFiles(f.p.id, [ambiguous]);
  expect(second.candidates).toHaveLength(2);
  expect(second.assetId).toBeNull();
  expect((await f.batch.preview(second.token)).width).toBe(12);
  await writeFile(ambiguous, await sharp(f.bytes).negate().png().toBuffer());
  await expect(f.batch.preview(second.token)).rejects.toThrow('已改變');
});
it('retains large-image consent through batch preview and commit without changing the source', async () => {
  const f = await fixture(),
    file = join(f.root, 'large.png');
  const bytes = await sharp({
    create: { width: 4097, height: 4096, channels: 4, background: 'red' },
  })
    .png()
    .toBuffer();
  await writeFile(file, bytes);
  const denied = await f.batch.chooseFiles(f.p.id, [file]);
  expect(denied[0].error).toContain('確認大圖');
  let prompts = 0;
  const batch = new BatchImports(f.catalog, f.versions, async () => {
    prompts++;
    return true;
  });
  const [row] = await batch.chooseFiles(f.p.id, [file]);
  expect(row.error).toBeNull();
  expect(prompts).toBe(1);
  const draft = await batch.inspect(row.token, f.assets[0].id);
  expect(draft.preview.width).toBe(4097);
  await batch.commit(f.p.id, [{ token: row.token, assetId: f.assets[0].id, accepted: true }]);
  const state = f.versions.state(f.assets[0].id);
  expect(await f.versions.bytes(f.assets[0].id, state.active)).toEqual(bytes);
  expect((await f.versions.preview(f.assets[0].id, state.active)).width).toBe(4097);
  expect(await readFile(join(f.game, f.assets[0].path))).toEqual(f.bytes);
}, 30000);
it('scan preview separates additions, changed and missing paths and never replaces a baseline', async () => {
  const f = await fixture(),
    before = f.catalog.assets(f.p.id);
  await writeFile(join(f.game, 'img/pictures/new.png'), f.bytes);
  await writeFile(join(f.game, before[0].path), 'external');
  await rm(join(f.game, before[1].path));
  const plan = await f.catalog.scanPlan(f.p.id);
  expect(plan.added).toEqual(['img/pictures/new.png']);
  expect(plan.changed).toEqual([before[0].path]);
  expect(plan.missing).toEqual([before[1].path]);
  expect(f.catalog.assets(f.p.id)).toEqual(before);
  await f.catalog.scanCommit(f.p.id, plan.token);
  expect(f.catalog.assets(f.p.id)).toHaveLength(3);
  for (const a of before) {
    expect(f.catalog.assets(f.p.id).find((x) => x.id === a.id)).toEqual(a);
    expect(await readFile(join(f.data, 'projects', f.p.id, 'originals', a.id + '.png'))).toEqual(
      f.bytes,
    );
  }
  await expect(f.catalog.scanCommit(f.p.id, plan.token)).rejects.toThrow('過期');
});
it('scan refuses a stale confirmation and does not duplicate already appended assets', async () => {
  const f = await fixture();
  await writeFile(join(f.game, 'img/pictures/new.png'), f.bytes);
  const plan = await f.catalog.scanPlan(f.p.id);
  await writeFile(join(f.game, 'img/pictures/new.png'), 'changed');
  await expect(f.catalog.scanCommit(f.p.id, plan.token)).rejects.toThrow('變更');
  expect(f.catalog.assets(f.p.id)).toHaveLength(2);
  await writeFile(join(f.game, 'img/pictures/new.png'), f.bytes);
  await f.catalog.scanCommit(f.p.id, (await f.catalog.scanPlan(f.p.id)).token);
  expect((await f.catalog.scanPlan(f.p.id)).added).toEqual([]);
});
it('reopened incomplete project resumes after move, validates saved originals and blocks early apply', async () => {
  const f = await fixture();
  f.store.db.prepare("UPDATE projects SET status='cancelled' WHERE id=?").run(f.p.id);
  await writeFile(join(f.game, 'img/pictures/new.png'), f.bytes);
  const moved = join(f.root, 'moved');
  await cp(f.game, moved, { recursive: true });
  const reopened = new Catalog(f.store, f.data);
  await reopened.relink(f.p.id, moved);
  const ops = new Operations(f.store, reopened, f.versions, f.data);
  await expect(ops.execute(f.p.id, 'apply')).rejects.toThrow('掃描尚未完成');
  const result = await reopened.scanCommit(f.p.id, (await reopened.scanPlan(f.p.id)).token);
  expect(result.status).toBe('ready');
  expect(reopened.assets(f.p.id)).toHaveLength(3);
  const saved = reopened.assets(f.p.id)[0];
  await writeFile(join(f.data, 'projects', f.p.id, 'originals', saved.id + '.png'), 'corrupt');
  await expect(reopened.scanPlan(f.p.id)).rejects.toThrow('損壞');
});
it('offline project keeps saved previews and refuses game writes', async () => {
  const f = await fixture();
  const { rename } = await import('node:fs/promises');
  await rename(f.game, join(f.root, 'moved'));
  expect((await f.catalog.availability(f.p.id)).online).toBe(false);
  expect((await f.catalog.preview(f.assets[0].id)).width).toBe(12);
  await expect(
    new Operations(f.store, f.catalog, f.versions, f.data).execute(f.p.id, 'apply'),
  ).rejects.toThrow();
});
it('initial basename pairing handles unique names, ambiguous names and invalid dropped formats', async () => {
  const f = await fixture();
  await writeFile(join(f.game, 'img/pictures/unique.png'), f.bytes);
  await f.catalog.scanCommit(f.p.id, (await f.catalog.scanPlan(f.p.id)).token);
  const input = join(f.root, 'input');
  await mkdir(input);
  await writeFile(join(input, 'UNIQUE.png'), f.bytes);
  await writeFile(join(input, 'a.png'), f.bytes);
  await writeFile(join(input, 'bad.jpg'), f.bytes);
  const rows = await f.batch.chooseFiles(
    f.p.id,
    ['UNIQUE.png', 'a.png', 'bad.jpg'].map((p) => join(input, p)),
  );
  expect(rows[0].assetId).toBe(
    f.catalog.assets(f.p.id).find((a) => a.path.endsWith('/unique.png'))?.id,
  );
  expect(rows[1].assetId).toBeNull();
  expect(rows[1].candidates).toHaveLength(2);
  expect(rows[2].error).toBeTruthy();
});
it('incremental scan compares deployed bytes rather than treating replacement as a new original', async () => {
  const f = await fixture(),
    a = f.assets[0],
    edit = await sharp(f.bytes).negate().png().toBuffer();
  await f.versions.importBatch([{ assetId: a.id, bytes: edit, name: 'edit.png', accepted: true }]);
  await new Operations(f.store, f.catalog, f.versions, f.data).execute(f.p.id, 'apply');
  const plan = await f.catalog.scanPlan(f.p.id);
  expect(plan.changed).toEqual([]);
  expect(plan.added).toEqual([]);
  expect(await readFile(join(f.data, 'projects', f.p.id, 'originals', a.id + '.png'))).toEqual(
    f.bytes,
  );
});
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
it('relink verifies existing content, leaves extra assets for confirmed scan and rejects duplicate destinations', async () => {
  const f = await fixture(),
    copy = join(f.root, 'copy');
  await cp(f.game, copy, { recursive: true });
  await writeFile(join(copy, 'img/pictures/new.png'), f.bytes);
  await f.catalog.relink(f.p.id, copy);
  expect(f.catalog.assets(f.p.id)).toHaveLength(2);
  expect((await f.catalog.scanPlan(f.p.id)).added).toEqual(['img/pictures/new.png']);
  await f.catalog.create(f.game, 'another', true);
  await expect(f.catalog.relink(f.p.id, f.game)).rejects.toThrow('其他專案');
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
