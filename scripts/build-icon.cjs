// Format conversion only; the approved artwork is kept in icon-source.png.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
async function main() {
  const root = path.resolve(__dirname, '../resources');
  const source = path.join(root, 'icon-source.png');
  await sharp(source).resize(512, 512).png().toFile(path.join(root, 'icon.png'));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const frames = [];
  for (const size of sizes) frames.push(await sharp(source).resize(size, size).png().toBuffer());
  const directory = Buffer.alloc(6 + 16 * sizes.length);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, i) => {
    const pos = 6 + i * 16;
    directory[pos] = directory[pos + 1] = size === 256 ? 0 : size;
    directory.writeUInt16LE(1, pos + 4);
    directory.writeUInt16LE(32, pos + 6);
    directory.writeUInt32LE(frames[i].length, pos + 8);
    directory.writeUInt32LE(offset, pos + 12);
    offset += frames[i].length;
  });
  await fs.writeFile(path.join(root, 'icon.ico'), Buffer.concat([directory, ...frames]));
  console.log('Created icon.png and icon.ico (16–256 px, 7 frames).');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
