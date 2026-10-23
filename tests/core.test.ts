import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { Store } from '../src/main/store';
import { checkStructure, decodePng, crc32 } from '../src/main/png';
function chunk(type: string, data: Buffer) {
  const b = Buffer.alloc(data.length + 12);
  b.writeUInt32BE(data.length);
  b.write(type, 4);
  data.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, -4)), b.length - 4);
  return b;
}
const png = () =>
  sharp({
    create: { width: 8, height: 6, channels: 4, background: { r: 30, g: 120, b: 90, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
describe('POC-03 SQLite persistence', () => {
  it('persists Unicode after closing and opening a fresh connection', () => {
    const root = mkdtempSync(join(tmpdir(), 'poc-db-'));
    try {
      let s = new Store(join(root, 'test.sqlite'));
      expect(s.load().note).toBe('');
      s.save('重新啟動測試 ✓');
      s.close();
      s = new Store(join(root, 'test.sqlite'));
      try {
        expect(s.load().note).toBe('重新啟動測試 ✓');
        expect(s.settings()).toEqual({ journal: 'wal', synchronous: 2, foreignKeys: 1 });
      } finally {
        s.close();
      }
    } finally {
      rmSync(root, { recursive: true });
    }
  });
  it('rejects invalid input and surfaces write failure without overwriting last saved state', () => {
    const root = mkdtempSync(join(tmpdir(), 'poc-db-'));
    const s = new Store(join(root, 'test.sqlite'));
    try {
      s.save('saved');
      expect(() => s.save('a'.repeat(2001))).toThrow();
      s.db.pragma('query_only = ON');
      expect(() => s.save('not saved')).toThrow();
      expect(s.load().note).toBe('saved');
    } finally {
      s.close();
      rmSync(root, { recursive: true });
    }
  });
});
describe('POC-03 PNG decoder — FR-008 partial', () => {
  it('fully decodes transparency and leaves original file bytes unchanged', async () => {
    const root = mkdtempSync(join(tmpdir(), 'poc-png-'));
    try {
      const b = await png();
      const file = join(root, 'sample.png');
      writeFileSync(file, b);
      const r = await decodePng(readFileSync(file), 'sample.png');
      expect([r.width, r.height, r.hasAlpha]).toEqual([8, 6, true]);
      expect(readFileSync(file).equals(b)).toBe(true);
      expect(r.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    } finally {
      rmSync(root, { recursive: true });
    }
  });
  it('rejects JPEG disguised with PNG extension', async () => {
    const b = await sharp(await png())
      .jpeg()
      .toBuffer();
    await expect(decodePng(b, 'fake.png')).rejects.toThrow('不是 PNG');
  });
  it('rejects PNG under unsupported extension', async () => {
    await expect(decodePng(await png(), 'x.jpg')).rejects.toThrow('只接受');
  });
  it('rejects truncation and CRC corruption', async () => {
    const b = await png();
    expect(() => checkStructure(b.subarray(0, -5))).toThrow();
    b[45] ^= 1;
    expect(() => checkStructure(b)).toThrow();
  });
  it.each(['acTL', 'fcTL', 'fdAT'])('rejects animation chunk %s', async (type) => {
    const b = await png();
    const animated = Buffer.concat([
      b.subarray(0, 33),
      chunk(type, Buffer.alloc(8)),
      b.subarray(33),
    ]);
    await expect(decodePng(animated, 'animated.png')).rejects.toThrow('APNG');
  });
  it('rejects invalid compressed pixel data even with correct CRC and metadata', async () => {
    const b = await png();
    const parts = [b.subarray(0, 8)];
    for (let p = 8; p < b.length;) {
      const n = b.readUInt32BE(p),
        t = b.toString('ascii', p + 4, p + 8);
      parts.push(t === 'IDAT' ? chunk(t, Buffer.from([1, 2, 3, 4])) : b.subarray(p, p + n + 12));
      p += n + 12;
    }
    await expect(decodePng(Buffer.concat(parts), 'bad.png')).rejects.toThrow();
  });
});
