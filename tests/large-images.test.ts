import { it, expect } from 'vitest';
import sharp from 'sharp';
import { performance } from 'node:perf_hooks';
import { decodePng, imageSize, MAX_PIXELS, MAX_LARGE_PIXELS, crc32 } from '../src/main/png';

it('requires consent above regular limit, retains exact dimensions and keeps previews bounded', async () => {
  const bytes = await sharp({
    create: { width: 4097, height: 4096, channels: 4, background: '#789abc' },
  })
    .png()
    .toBuffer();
  expect(imageSize(bytes).pixels).toBeGreaterThan(MAX_PIXELS);
  await expect(decodePng(bytes, 'large.png')).rejects.toThrow('確認大圖');
  const start = performance.now(),
    rss = process.memoryUsage().rss;
  const result = await decodePng(bytes, 'large.png', true);
  expect(result.width).toBe(4097);
  expect(result.height).toBe(4096);
  const thumb = await sharp(Buffer.from(result.dataUrl.split(',')[1], 'base64')).metadata();
  expect(thumb.width).toBeLessThanOrEqual(1200);
  expect(thumb.height).toBeLessThanOrEqual(800);
  console.log(
    JSON.stringify({
      largeImagePixels: 4097 * 4096,
      decodeMs: Math.round(performance.now() - start),
      rssDeltaMiB: Math.round((process.memoryUsage().rss - rss) / 1024 / 1024),
    }),
  );
}, 30000);
it('accepts the measured hard boundary with consent and rejects anything above it before decoding', async () => {
  const bytes = await sharp({
    create: { width: 8192, height: 4096, channels: 4, background: 'blue' },
  })
    .png()
    .toBuffer();
  expect(imageSize(bytes).pixels).toBe(MAX_LARGE_PIXELS);
  const start = performance.now();
  const result = await decodePng(bytes, 'boundary.png', true);
  expect(result.width).toBe(8192);
  console.log(
    JSON.stringify({
      hardBoundaryPixels: MAX_LARGE_PIXELS,
      decodeMs: Math.round(performance.now() - start),
    }),
  );
  const oversized = Buffer.from(bytes);
  oversized.writeUInt32BE(8193, 16);
  oversized.writeUInt32BE(crc32(oversized.subarray(12, 29)), 29);
  await expect(decodePng(oversized, 'too-big.png', true)).rejects.toThrow('安全上限');
}, 30000);
