import { checkStructure } from './png';
// Standard MV/MZ container. No custom encryption or key inference.
const HEADER = Buffer.from('5250474d560000000003010000000000', 'hex');
export function pngPath(path: string) {
  return path.replace(/\.rpgmvp$/i, '.png').replace(/\.png_$/i, '.png');
}
export function encryptedPath(path: string) {
  return /\.(rpgmvp|png_)$/i.test(path);
}
export function validateKey(key: unknown): string {
  if (typeof key !== 'string' || !/^[a-f\d]{32}$/i.test(key)) throw Error('標準加密金鑰無效');
  return key.toLowerCase();
}
export function decodeGame(bytes: Buffer, path: string, key: string | null) {
  if (!encryptedPath(path)) return bytes;
  if (!key) throw Error('加密圖片缺少專案金鑰');
  const k = Buffer.from(validateKey(key), 'hex');
  if (bytes.length < 32 || !bytes.subarray(0, 16).equals(HEADER)) throw Error('不支援的加密標頭');
  const png = Buffer.from(bytes.subarray(16));
  for (let i = 0; i < 16; i++) png[i] ^= k[i];
  checkStructure(png);
  return png;
}
export function encodeGame(png: Buffer, path: string, key: string | null) {
  if (!encryptedPath(path)) return png;
  if (!key) throw Error('加密圖片缺少專案金鑰');
  checkStructure(png);
  const out = Buffer.concat([HEADER, png]),
    k = Buffer.from(validateKey(key), 'hex');
  for (let i = 0; i < 16; i++) out[16 + i] ^= k[i];
  return out;
}
