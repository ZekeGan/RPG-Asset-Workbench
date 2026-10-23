import { it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { Store } from '../src/main/store';
import { Catalog } from '../src/main/catalog';
import { Versions } from '../src/main/versions';
import { Operations } from '../src/main/operations';
import { Exporter } from '../src/main/exporter';
import { BatchImports } from '../src/main/batch';
import { decodeGame } from '../src/main/codec';
const key = '0123456789abcdef0123456789abcdef';
// Fixture encoding is independent of the production codec, following the standard engine header/XOR layout.
function fixtureEncode(png: Buffer) {
  const out = Buffer.alloc(png.length + 16);
  [82, 80, 71, 77, 86, 0, 0, 0, 0, 3, 1, 0, 0, 0, 0, 0].forEach((n, i) => (out[i] = n));
  png.copy(out, 16);
  for (let i = 0; i < 16; i++)
    out[i + 16] = png[i] ^ Number.parseInt(key.slice(i * 2, i * 2 + 2), 16);
  return out;
}
const dirs: string[] = [],
  stores: Store[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function fixture(engine: 'MV' | 'MZ') {
  const root = await mkdtemp(join(tmpdir(), 'enc04-'));
  dirs.push(root);
  const game = join(root, 'game'),
    data = join(root, 'tool'),
    out = join(root, 'output');
  for (const d of [data, out, join(game, 'js'), join(game, 'data'), join(game, 'img/pictures')])
    await mkdir(d, { recursive: true });
  await writeFile(
    join(game, 'js', engine === 'MV' ? 'rpg_core.js' : 'rmmz_core.js'),
    `Utils.RPGMAKER_NAME='${engine}'`,
  );
  await writeFile(
    join(game, 'data/System.json'),
    JSON.stringify({ hasEncryptedImages: true, encryptionKey: key }),
  );
  const png = await sharp({ create: { width: 8, height: 6, channels: 4, background: '#aabbcc' } })
      .png()
      .toBuffer(),
    raw = fixtureEncode(png);
  for (const n of ['a', 'b', 'c'])
    await writeFile(join(game, 'img/pictures', n + (engine === 'MV' ? '.rpgmvp' : '.png_')), raw);
  const store = new Store(join(data, 'catalog.sqlite'));
  stores.push(store);
  const catalog = new Catalog(store, data),
    project = await catalog.create(game, 'encrypted', true),
    versions = new Versions(store, catalog, data),
    assets = catalog.assets(project.id);
  return { root, game, data, out, png, raw, store, catalog, project, versions, assets };
}
it.each(['MV', 'MZ'] as const)(
  '%s selecting original applies exact saved ciphertext and preserves V1 history',
  async (engine) => {
    const f = await fixture(engine),
      ops = new Operations(f.store, f.catalog, f.versions, f.data);
    const edit = await sharp(f.png).negate().png().toBuffer();
    await f.versions.importBatch(
      f.assets.map((a) => ({ assetId: a.id, bytes: edit, name: 'edit.png', accepted: true })),
    );
    await ops.execute(f.project.id, 'apply');
    for (const a of f.assets) await f.versions.select(a.id, null);
    for (const a of f.assets)
      expect(await readFile(join(f.game, a.path))).toEqual(fixtureEncode(edit));
    await ops.execute(f.project.id, 'apply');
    for (const a of f.assets) {
      expect(await readFile(join(f.game, a.path))).toEqual(f.raw);
      expect(f.versions.state(a.id).deployed).toBeNull();
      expect(f.versions.state(a.id).versions).toHaveLength(1);
    }
  },
);
it.each(['MV', 'MZ'] as const)(
  '%s encrypted scan preserves raw originals, exports PNG, applies and restores exact encrypted bytes',
  async (engine) => {
    const f = await fixture(engine);
    expect(f.project.status).toBe('ready');
    expect(f.assets).toHaveLength(3);
    for (const a of f.assets) {
      expect(
        await readFile(join(f.data, 'projects', f.project.id, 'originals', a.id + '.png')),
      ).toEqual(f.raw);
      expect((await f.catalog.preview(a.id)).width).toBe(8);
      expect(await f.versions.bytes(a.id, null)).toEqual(f.png);
    }
    const exporter = new Exporter(f.versions, f.catalog, f.data);
    expect(
      (
        await exporter.run(
          await exporter.prepare(
            f.assets.map((a) => a.id),
            'original',
            f.out,
          ),
          'skip',
        )
      ).completed,
    ).toHaveLength(3);
    expect(await readFile(join(f.out, 'img/pictures/a.png'))).toEqual(f.png);
    const batch = new BatchImports(f.catalog, f.versions),
      paired = await batch.choose(f.project.id, f.out);
    expect(paired.every((f) => f.assetId)).toBe(true);
    const edit = await sharp(f.png).negate().png().toBuffer();
    await f.versions.importBatch(
      f.assets.map((a) => ({ assetId: a.id, bytes: edit, name: 'edited.png', accepted: true })),
    );
    const ops = new Operations(f.store, f.catalog, f.versions, f.data);
    await ops.execute(f.project.id, 'apply');
    for (const a of f.assets)
      expect(await readFile(join(f.game, a.path))).toEqual(fixtureEncode(edit));
    const copy = join(f.root, 'moved');
    await cp(f.game, copy, { recursive: true });
    await f.catalog.relink(f.project.id, copy);
    await ops.execute(
      f.project.id,
      'restore',
      f.assets.map((a) => a.id),
    );
    for (const a of f.assets) expect(await readFile(join(copy, a.path))).toEqual(f.raw);
  },
);
it.each(['MV', 'MZ'] as const)(
  '%s encrypted partial write failure restores operation-before bytes',
  async (engine) => {
    const f = await fixture(engine),
      edit = await sharp(f.png).negate().png().toBuffer();
    await f.versions.importBatch(
      f.assets.map((a) => ({ assetId: a.id, bytes: edit, name: 'edited.png', accepted: true })),
    );
    const ops = new Operations(f.store, f.catalog, f.versions, f.data, (p, i) => {
      if (p === 'before-write' && i === 1) throw Error('injected');
    });
    await expect(ops.execute(f.project.id, 'apply')).rejects.toThrow('injected');
    for (const a of f.assets) expect(await readFile(join(f.game, a.path))).toEqual(f.raw);
    expect(ops.list(f.project.id)[0].status).toBe('recovered');
  },
);
it('rejects wrong header, wrong key and externally changed encryption settings', async () => {
  const f = await fixture('MZ');
  const bad = Buffer.from(f.raw);
  bad[0] = 0;
  expect(() => decodeGame(bad, 'a.png_', key)).toThrow('標頭');
  expect(() => decodeGame(f.raw, 'a.png_', '00000000000000000000000000000000')).toThrow();
  await f.versions.importBatch([
    { assetId: f.assets[0].id, bytes: f.png, name: 'a.png', accepted: true },
  ]);
  await writeFile(
    join(f.game, 'data/System.json'),
    JSON.stringify({ hasEncryptedImages: true, encryptionKey: '0'.repeat(32) }),
  );
  await expect(
    new Operations(f.store, f.catalog, f.versions, f.data).execute(f.project.id, 'apply'),
  ).rejects.toThrow('設定');
  for (const a of f.assets) expect(await readFile(join(f.game, a.path))).toEqual(f.raw);
});
