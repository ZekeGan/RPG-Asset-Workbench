import { it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { Store } from '../src/main/store';
import { Catalog } from '../src/main/catalog';
import { Versions } from '../src/main/versions';
import { Exporter } from '../src/main/exporter';
import { Operations } from '../src/main/operations';
const roots: string[] = [],
  stores: Store[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.close();
  for (const p of roots.splice(0)) await rm(p, { recursive: true, force: true });
});
export async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'rpg-versions-'));
  roots.push(root);
  const data = join(root, 'tool'),
    game = join(root, 'game'),
    out = join(root, 'export');
  for (const d of [data, out, join(game, 'js'), join(game, 'data'), join(game, 'img/pictures')])
    await mkdir(d, { recursive: true });
  await writeFile(join(game, 'data/System.json'), '{}');
  await writeFile(join(game, 'js/rmmz_core.js'), "Utils.RPGMAKER_NAME = 'MZ'");
  const bytes = await sharp({ create: { width: 4, height: 3, channels: 4, background: 'red' } })
    .png()
    .toBuffer();
  for (const name of ['a', 'b'])
    await writeFile(join(game, 'img/pictures/' + name + '.png'), bytes);
  const store = new Store(join(data, 'catalog.sqlite'));
  stores.push(store);
  const catalog = new Catalog(store, data),
    project = await catalog.create(game, 'test', true),
    assets = catalog.assets(project.id),
    versions = new Versions(store, catalog, data),
    exporter = new Exporter(versions, catalog, data);
  return { root, data, game, out, bytes, store, catalog, project, assets, versions, exporter };
}
it('imports exact bytes, persists active separately and never changes game', async () => {
  const f = await setup(),
    a = f.assets[0];
  await f.versions.importBatch([
    { assetId: a.id, bytes: f.bytes, name: 'new.png', accepted: false },
  ]);
  const s = f.versions.state(a.id);
  expect(s.versions[0].number).toBe(1);
  expect(s.deployed).toBeNull();
  expect(await f.versions.bytes(a.id, s.active)).toEqual(f.bytes);
  expect(await readFile(join(f.game, a.path))).toEqual(f.bytes);
  const second = new Versions(f.store, f.catalog, f.data);
  expect(second.state(a.id)).toEqual(s);
  await second.select(a.id, null);
  expect(second.state(a.id).versions).toHaveLength(1);
});
it('requires explicit dimension and transparency acceptance; invalid bytes cannot bypass', async () => {
  const f = await setup(),
    id = f.assets[0].id,
    b = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'blue' } })
      .png()
      .toBuffer();
  expect((await f.versions.check(id, b, 'x.png')).differences).toHaveLength(3);
  await expect(
    f.versions.importBatch([{ assetId: id, bytes: b, name: 'x.png', accepted: false }]),
  ).rejects.toThrow('接受');
  expect(f.versions.state(id).versions).toHaveLength(0);
  await f.versions.importBatch([{ assetId: id, bytes: b, name: 'x.png', accepted: true }]);
  await expect(
    f.versions.importBatch([
      { assetId: id, bytes: Buffer.from('bad'), name: 'x.png', accepted: true },
    ]),
  ).rejects.toThrow();
  expect(f.versions.state(id).versions).toHaveLength(1);
});
it('protects active and deployed history; deletion never reuses version numbers', async () => {
  const f = await setup(),
    id = f.assets[0].id;
  for (let i = 0; i < 2; i++)
    await f.versions.importBatch([{ assetId: id, bytes: f.bytes, name: 'x.png', accepted: true }]);
  let s = f.versions.state(id);
  await expect(f.versions.remove(id, s.active!)).rejects.toThrow('不可刪');
  const first = s.versions[1].id;
  f.store.db.prepare('UPDATE selections SET deployed=? WHERE asset_id=?').run(first, id);
  await expect(f.versions.remove(id, first)).rejects.toThrow('不可刪');
  f.store.db.prepare('UPDATE selections SET deployed=NULL WHERE asset_id=?').run(id);
  await f.versions.remove(id, first);
  await f.versions.importBatch([{ assetId: id, bytes: f.bytes, name: 'x.png', accepted: true }]);
  expect(f.versions.state(id).versions.map((v) => v.number)).toEqual([3, 2]);
});
it('rolls back every visible version when a later batch item or DB commit fails', async () => {
  const f = await setup();
  await expect(
    f.versions.importBatch(
      f.assets.map((a, i) => ({
        assetId: a.id,
        bytes: i ? Buffer.from('bad') : f.bytes,
        name: 'x.png',
        accepted: true,
      })),
    ),
  ).rejects.toThrow();
  for (const a of f.assets) expect(f.versions.state(a.id).versions).toHaveLength(0);
  f.store.db.exec(
    "CREATE TRIGGER fail_version BEFORE INSERT ON versions BEGIN SELECT RAISE(ABORT,'injected full disk'); END",
  );
  await expect(
    f.versions.importBatch([
      { assetId: f.assets[0].id, bytes: f.bytes, name: 'x.png', accepted: true },
    ]),
  ).rejects.toThrow('injected');
  expect(f.versions.state(f.assets[0].id).active).toBeNull();
});
it('rejects duplicate batch targets and cross-asset version selection', async () => {
  const f = await setup(),
    a = f.assets[0],
    item = { assetId: a.id, bytes: f.bytes, name: 'x.png', accepted: true };
  await expect(f.versions.importBatch([item, item])).rejects.toThrow('重複');
  await f.versions.importBatch([item]);
  await expect(f.versions.select(f.assets[1].id, f.versions.state(a.id).active)).rejects.toThrow(
    '不屬於',
  );
});
it('exports fixed original or active bytes with preserved paths and fallback', async () => {
  const f = await setup(),
    a = f.assets[0],
    edited = await sharp(f.bytes).negate().png().toBuffer();
  await f.versions.importBatch([
    { assetId: a.id, bytes: edited, name: 'edited.png', accepted: true },
  ]);
  const plan = await f.exporter.prepare(
    f.assets.map((a) => a.id),
    'active',
    f.out,
  );
  expect((await f.exporter.run(plan, 'skip')).completed).toHaveLength(2);
  expect(await readFile(join(f.out, a.path))).toEqual(edited);
  expect(await readFile(join(f.out, f.assets[1].path))).toEqual(f.bytes);
  expect(await readFile(join(f.game, a.path))).toEqual(f.bytes);
});
it('preflights collisions and implements cancel, skip and explicit overwrite', async () => {
  const f = await setup(),
    a = f.assets[0];
  await mkdir(join(f.out, 'img/pictures'), { recursive: true });
  await writeFile(join(f.out, a.path), 'existing');
  const p = await f.exporter.prepare([a.id], 'original', f.out);
  expect(p.conflicts).toEqual([a.path]);
  await f.exporter.run(p, 'cancel');
  expect((await readFile(join(f.out, a.path))).toString()).toBe('existing');
  await f.exporter.run(p, 'skip');
  expect((await readFile(join(f.out, a.path))).toString()).toBe('existing');
  expect((await f.exporter.run(p, 'overwrite')).completed).toEqual([a.path]);
  expect(await readFile(join(f.out, a.path))).toEqual(f.bytes);
});
it('blocks protected destinations, symlinks and new collisions after preflight', async () => {
  const f = await setup(),
    id = f.assets[0].id;
  await expect(f.exporter.prepare([id], 'original', f.game)).rejects.toThrow('重疊');
  await expect(f.exporter.prepare([id], 'original', f.data)).rejects.toThrow('重疊');
  const p = await f.exporter.prepare([id], 'original', f.out);
  await mkdir(join(f.out, 'img/pictures'), { recursive: true });
  await writeFile(join(f.out, f.assets[0].path), 'new');
  expect((await f.exporter.run(p, 'overwrite')).failed).toHaveLength(1);
  expect((await readFile(join(f.out, f.assets[0].path))).toString()).toBe('new');
  await rm(join(f.out, 'img'), { recursive: true });
  await symlink(join(f.game, 'img'), join(f.out, 'img'), 'junction');
  await expect(f.exporter.prepare([id], 'original', f.out)).rejects.toThrow('連結');
});
it('reports per-file export failure when one baseline is corrupted', async () => {
  const f = await setup(),
    a = f.assets[0];
  await writeFile(join(f.data, 'projects', a.projectId, 'originals', a.id + '.png'), 'bad');
  const r = await f.exporter.run(
    await f.exporter.prepare(
      f.assets.map((a) => a.id),
      'original',
      f.out,
    ),
    'skip',
  );
  expect(r.failed).toHaveLength(1);
  expect(r.completed).toHaveLength(1);
});

async function ready() {
  const f = await setup();
  await writeFile(join(f.game, 'img/pictures/c.png'), f.bytes); // Three independent target assets for partial-write tests.
  const game2 = join(f.root, 'game3');
  await mkdir(game2);
  const { cp } = await import('node:fs/promises');
  await cp(f.game, game2, { recursive: true });
  const project = await f.catalog.create(game2, 'three', true),
    assets = f.catalog.assets(project.id);
  const edit = await sharp(f.bytes).negate().png().toBuffer();
  await f.versions.importBatch(
    assets.map((a) => ({ assetId: a.id, bytes: edit, name: 'edit.png', accepted: true })),
  );
  return { ...f, project, assets, game: game2, edit };
}
it('applies and restores three files, preserving active and history', async () => {
  const f = await ready(),
    ops = new Operations(f.store, f.catalog, f.versions, f.data);
  expect((await ops.execute(f.project.id, 'apply')).status).toBe('committed');
  for (const a of f.assets) {
    expect(await readFile(join(f.game, a.path))).toEqual(f.edit);
    expect(f.versions.state(a.id).deployed).toBe(f.versions.state(a.id).active);
  }
  await ops.execute(
    f.project.id,
    'restore',
    f.assets.map((a) => a.id),
  );
  for (const a of f.assets) {
    expect(await readFile(join(f.game, a.path))).toEqual(f.bytes);
    expect(f.versions.state(a.id).active).not.toBeNull();
    expect(f.versions.state(a.id).deployed).toBeNull();
  }
});
it('restores previous deployment rather than original after partial second apply failure', async () => {
  const f = await ready();
  await new Operations(f.store, f.catalog, f.versions, f.data).execute(f.project.id, 'apply');
  const next = await sharp(f.bytes).grayscale().png().toBuffer();
  await f.versions.importBatch(
    f.assets.map((a) => ({ assetId: a.id, bytes: next, name: 'next.png', accepted: true })),
  );
  const ops = new Operations(f.store, f.catalog, f.versions, f.data, (point, i) => {
    if (point === 'before-write' && i === 1) throw Error('injected write failure');
  });
  await expect(ops.execute(f.project.id, 'apply')).rejects.toThrow('injected');
  expect(ops.list(f.project.id)[0].status).toBe('recovered');
  for (const a of f.assets) {
    expect(await readFile(join(f.game, a.path))).toEqual(f.edit);
    expect(f.versions.state(a.id).deployed).not.toBe(f.versions.state(a.id).active);
  }
});
it('blocks an entire apply on external changes before any write', async () => {
  const f = await ready();
  await writeFile(join(f.game, f.assets[1].path), 'external');
  const ops = new Operations(f.store, f.catalog, f.versions, f.data);
  await expect(ops.execute(f.project.id, 'apply')).rejects.toThrow('外部');
  expect(await readFile(join(f.game, f.assets[0].path))).toEqual(f.bytes);
  expect(ops.list(f.project.id)).toHaveLength(0);
});
it('retains recovery failure and retries without blindly overwriting third-party changes', async () => {
  const f = await ready();
  const ops = new Operations(f.store, f.catalog, f.versions, f.data, (point, i) => {
    if (point === 'before-write' && i === 1) throw Error('write failed');
    if (point === 'recovery-write') throw Error('recovery failed');
  });
  await expect(ops.execute(f.project.id, 'apply')).rejects.toThrow('恢復未完成');
  const op = ops.list(f.project.id)[0];
  expect(op.status).toBe('recovery_failed');
  expect(() => ops.assertEditable(f.project.id)).toThrow();
  await writeFile(join(f.game, f.assets[2].path), 'external');
  const reopened = new Operations(f.store, f.catalog, f.versions, f.data);
  await expect(reopened.recover(f.project.id, op.id)).rejects.toThrow('外部');
  expect((await readFile(join(f.game, f.assets[2].path))).toString()).toBe('external');
  await writeFile(join(f.game, f.assets[2].path), f.bytes);
  expect((await reopened.recover(f.project.id, op.id)).status).toBe('recovered');
  for (const a of f.assets) expect(await readFile(join(f.game, a.path))).toEqual(f.bytes);
});
it('rolls back when all files are written but deployment commit fails', async () => {
  const f = await ready(),
    ops = new Operations(f.store, f.catalog, f.versions, f.data, (point) => {
      if (point === 'before-commit') throw Error('commit failed');
    });
  await expect(ops.execute(f.project.id, 'apply')).rejects.toThrow('commit failed');
  for (const a of f.assets) {
    expect(await readFile(join(f.game, a.path))).toEqual(f.bytes);
    expect(f.versions.state(a.id).deployed).toBeNull();
  }
});
it('survives actual child-process termination at durable intent, first file and precommit', async () => {
  const { build } = await import('vite'),
    { spawnSync } = await import('node:child_process');
  const bundle = await mkdtemp(join(process.cwd(), '.crash-test-'));
  roots.push(bundle);
  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      ssr: join(process.cwd(), 'tests/fixtures/crash-worker.ts'),
      outDir: bundle,
      rollupOptions: {
        external: ['better-sqlite3', 'sharp'],
        output: { entryFileNames: 'worker.mjs' },
      },
    },
  });
  for (const point of ['intent', 'after-write', 'before-commit']) {
    const f = await ready();
    const child = spawnSync(
      process.execPath,
      [join(bundle, 'worker.mjs'), f.data, f.project.id, point],
      { encoding: 'utf8' },
    );
    expect(child.status, child.stderr).toBe(77);
    const ops = new Operations(f.store, f.catalog, f.versions, f.data),
      op = ops.list(f.project.id)[0];
    expect(op.status).toBe('applying');
    expect(() => ops.assertEditable(f.project.id)).toThrow();
    const beforeRecovery = await readFile(join(f.game, f.assets[0].path));
    expect(beforeRecovery).toEqual(point === 'intent' ? f.bytes : f.edit);
    await ops.recover(f.project.id, op.id);
    for (const a of f.assets) expect(await readFile(join(f.game, a.path))).toEqual(f.bytes);
  }
});
it('restores the deployed version after a partial restore fails', async () => {
  const f = await ready();
  await new Operations(f.store, f.catalog, f.versions, f.data).execute(f.project.id, 'apply');
  const ops = new Operations(f.store, f.catalog, f.versions, f.data, (p, i) => {
    if (p === 'before-write' && i === 1) throw Error('restore write failed');
  });
  await expect(
    ops.execute(
      f.project.id,
      'restore',
      f.assets.map((a) => a.id),
    ),
  ).rejects.toThrow('restore write failed');
  for (const a of f.assets) {
    expect(await readFile(join(f.game, a.path))).toEqual(f.edit);
    expect(f.versions.state(a.id).deployed).toBe(f.versions.state(a.id).active);
  }
});
it('refuses writes when original backup is corrupted', async () => {
  const f = await ready(),
    a = f.assets[2];
  await writeFile(join(f.data, 'projects', a.projectId, 'originals', a.id + '.png'), 'corrupt');
  await expect(
    new Operations(f.store, f.catalog, f.versions, f.data).execute(f.project.id, 'apply'),
  ).rejects.toThrow('損壞');
  for (const a of f.assets) expect(await readFile(join(f.game, a.path))).toEqual(f.bytes);
});
