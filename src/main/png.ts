import sharp from 'sharp';
import { createHash } from 'node:crypto';
import type { Preview } from '../shared/contracts';
export const MAX_BYTES = 32 * 1024 * 1024;
export const MAX_PIXELS = 16_777_216;
export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const n of b) {
    c ^= n;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
export function checkStructure(b: Buffer) {
  if (b.length > MAX_BYTES) throw new Error('超過本次 PoC 32 MiB 檢查上限');
  if (!b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    throw new Error('只能使用靜態 PNG，檔案內容不是 PNG');
  let p = 8,
    first = true,
    idat = false,
    end = false;
  while (p < b.length) {
    if (p + 12 > b.length) throw new Error('PNG 區塊截斷');
    const n = b.readUInt32BE(p);
    if (n > b.length - p - 12) throw new Error('PNG 區塊長度錯誤');
    const type = b.toString('ascii', p + 4, p + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error('PNG 區塊名稱錯誤');
    if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw new Error('不支援 APNG 動態圖片');
    if (crc32(b.subarray(p + 4, p + 8 + n)) !== b.readUInt32BE(p + 8 + n))
      throw new Error('PNG CRC 損毀');
    if (first) {
      if (type !== 'IHDR' || n !== 13) throw new Error('PNG 缺少有效 IHDR');
      first = false;
    } else if (type === 'IHDR') throw new Error('PNG 重複 IHDR');
    if (type === 'IDAT') idat = true;
    p += 12 + n;
    if (type === 'IEND') {
      if (n !== 0 || !idat || p !== b.length) throw new Error('PNG 結尾錯誤');
      end = true;
      break;
    }
  }
  if (!end) throw new Error('PNG 不完整');
}
async function decodeOne(bytes: Buffer, name: string): Promise<Preview> {
  if (!name.toLowerCase().endsWith('.png')) throw new Error('只接受 .png 圖片，其他格式不能匯入');
  checkStructure(bytes);
  const pipeline = sharp(bytes, { failOn: 'warning', limitInputPixels: MAX_PIXELS });
  const metadata = await pipeline.metadata();
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const thumb = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize({ width: 1200, height: 800, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  return {
    name,
    width: info.width,
    height: info.height,
    hasAlpha: metadata.hasAlpha ?? false,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    dataUrl: 'data:image/png;base64,' + thumb.toString('base64'),
  };
}

// Bound simultaneous native decodes across scan and preview requests.
let decodeTail: Promise<unknown> = Promise.resolve();
export function decodePng(bytes: Buffer, name: string): Promise<Preview> {
  const result = decodeTail.then(() => decodeOne(bytes, name));
  decodeTail = result.catch(() => undefined);
  return result;
}
