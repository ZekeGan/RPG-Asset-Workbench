const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packaged = path.join(root, 'release', 'win-unpacked');
const documentation = path.join(packaged, 'Documentation');
const packageNames = [
  '@emnapi/runtime',
  '@img/colour',
  '@img/sharp-win32-x64',
  'better-sqlite3',
  'detect-libc',
  'node-addon-api',
  'react',
  'react-dom',
  'scheduler',
  'semver',
  'sharp',
  'tslib',
];

async function copy(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(root, source), destination);
}

async function main() {
  const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
  const exe = path.join(packaged, 'RPG Asset Workbench.exe');
  await fs.access(exe);
  // Constrain removal to this generated directory inside this repository.
  if (!documentation.startsWith(path.join(root, 'release') + path.sep))
    throw Error('Invalid release documentation path');
  await fs.rm(documentation, { recursive: true, force: true });
  await fs.mkdir(documentation, { recursive: true });
  for (const [source, name] of [
    ['LICENSE', 'LICENSE'],
    ['README.md', 'README.md'],
    ['docs/user/README.zh-CN.md', 'docs/user/README.zh-CN.md'],
    ['docs/user/README.ja.md', 'docs/user/README.ja.md'],
    ['docs/user/README.en.md', 'docs/user/README.en.md'],
    [`docs/UPDATE_${version}.md`, `docs/UPDATE_${version}.md`],
    ['resources/icon.png', 'resources/icon.png'],
  ])
    await copy(source, path.join(documentation, name));
  for (const readme of [
    'README.md',
    'docs/user/README.zh-CN.md',
    'docs/user/README.ja.md',
    'docs/user/README.en.md',
  ]) {
    const target = path.join(documentation, readme);
    const body = await fs.readFile(target, 'utf8');
    // Development documentation is intentionally omitted from the user distribution.
    await fs.writeFile(
      target,
      body.replace(/\s*·\s*\[[^\]]+\]\([^)]*development\/INDEX\.md\)/g, ''),
    );
  }

  const notice = [
    '# Third-party notices',
    '',
    'This application is MIT licensed; see LICENSE in this folder.',
    'Electron and Chromium notices are supplied separately in the application folder as LICENSE.electron.txt and LICENSES.chromium.html.',
    'The packages below are included in the Windows x64 application or its bundled renderer. License texts are preserved under third-party/.',
    '',
    '| Component | Version | Declared license |',
    '|---|---|---|',
  ];
  for (const name of packageNames) {
    const directory = path.join(root, 'node_modules', ...name.split('/'));
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
    const licenseFile = (await fs.readdir(directory)).find((file) =>
      /^licen[cs]e(?:\.|$)/i.test(file),
    );
    if (!licenseFile) throw Error(`Missing license text for ${name}`);
    const safeName = name.replaceAll('/', '__');
    const target = path.join(documentation, 'third-party', safeName);
    await fs.mkdir(target, { recursive: true });
    await fs.copyFile(path.join(directory, licenseFile), path.join(target, licenseFile));
    if (name === '@img/sharp-win32-x64')
      await fs.copyFile(path.join(directory, 'README.md'), path.join(target, 'README.md'));
    notice.push(`| ${name} | ${manifest.version} | ${manifest.license} |`);
  }
  notice.push(
    '',
    'The @img/sharp-win32-x64 README identifies libvips and other LGPL components. This inventory alone is not a completed LGPL distribution review. Before public release, verify the applicable full GPL/LGPL texts, the corresponding source and relinking requirements for the bundled binaries, and all remaining notices.',
    'Library licenses: https://www.gnu.org/licenses/lgpl-3.0.html ; source project: https://github.com/lovell/sharp-libvips .',
    '',
  );
  await fs.writeFile(path.join(documentation, 'THIRD_PARTY_NOTICES.md'), notice.join('\n'));
  console.log(`Prepared documentation and ${packageNames.length} package licenses.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
