const captureWindow = require('./electron-capture.cjs');
// Run after build and native:electron. Uses only generated fixtures and isolated userData.
const { app, BrowserWindow, dialog, Menu } = require('electron');
// Render fixtures offscreen so a locked/occluded desktop cannot invalidate screenshots.
const Module = require('node:module');
const originalLoad = Module._load;
const electron = require('electron');
let releaseScan;
let scanCalls = 0;
const scanGate = new Promise((resolve) => {
  releaseScan = resolve;
});
const originalHandle = electron.ipcMain.handle.bind(electron.ipcMain);
electron.ipcMain.handle = (channel, listener) =>
  originalHandle(channel, async (...args) => {
    if (process.env.SCAN_UI_QA && channel === 'catalog:scan-commit') {
      scanCalls++;
      await scanGate;
    }
    return listener(...args);
  });
function TestWindow(options) {
  return new BrowserWindow({
    ...options,
    show: false,
    webPreferences: { ...options.webPreferences, offscreen: true },
  });
}
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return { ...electron, BrowserWindow: TestWindow };
  return originalLoad.call(this, request, parent, isMain);
};
// Stable capture in a hidden Windows test window, independent of GPU availability.
app.disableHardwareAcceleration();
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const base = path.resolve('out/qa-' + Date.now());
const game = path.join(base, 'game');
const editPath = path.join(base, 'edited.png');
const output = path.resolve(
  'docs/evidence',
  process.env.SCAN_UI_QA
    ? 'scan-feedback'
    : process.env.FEATURE_UI_QA
      ? 'languages-drag'
      : process.env.NEXT_UI_QA
        ? 'next'
        : '.',
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let selected = game;
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
let dialogResponse = 0,
  lastDialog;
dialog.showMessageBox = async (_win, options) => {
  lastDialog = options;
  return { response: dialogResponse };
};
const errors = [];
const fixtureWindows = [];
app.on('browser-window-created', (_event, win) => {
  fixtureWindows.push(win);
  if (!win.webContents.isOffscreen()) win.hide();
  win.webContents.setBackgroundThrottling(false);
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error') errors.push(event.message);
  });
});
(async () => {
  for (const dir of ['userData', 'game/js', 'game/data', 'game/img/pictures'])
    await fs.mkdir(path.join(base, dir), { recursive: true });
  app.setPath('userData', path.join(base, 'userData'));
  await fs.writeFile(path.join(game, 'js/rmmz_core.js'), "Utils.RPGMAKER_NAME='MZ'");
  await fs.writeFile(path.join(game, 'data/System.json'), '{}');
  const original = await sharp({
    create: { width: 400, height: 300, channels: 4, background: '#637b88' },
  })
    .png()
    .toBuffer();
  const edited = await sharp({
    create: { width: 400, height: 300, channels: 4, background: '#bc855d' },
  })
    .png()
    .toBuffer();
  await fs.writeFile(path.join(game, 'img/pictures/a.png'), original);
  await fs.writeFile(editPath, edited);
  require('../out/main/index.js');
  let win;
  for (let i = 0; i < 100; i++) {
    win = fixtureWindows[0];
    if (win && !win.webContents.isLoading()) break;
    await sleep(100);
  }
  assert(win, 'main window exists');
  const js = (code) => win.webContents.executeJavaScript(code);
  const wait = async (code) => {
    for (let i = 0; i < 100; i++) {
      if (await js(code)) return;
      await sleep(100);
    }
    throw Error('UI timeout: ' + code);
  };
  const click = async (label) => {
    await wait(
      `Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===${JSON.stringify(label)} && !b.disabled)`,
    );
    await js(
      `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`,
    );
  };
  await wait('!!window.catalog');
  const unwrap = (r) => {
    assert(r.ok, r.error);
    return r.value;
  };
  const draft = unwrap(await js('window.catalog.choose()'));
  const project = unwrap(
    await js(`window.catalog.create(${JSON.stringify(draft.token)}, '自製測試專案', true)`),
  );
  const id = JSON.stringify(project.id);
  const assets = unwrap(await js(`window.catalog.assets(${id})`));
  const asset = JSON.stringify(assets[0].id);
  selected = editPath;
  await js(
    "{const input=document.createElement('input');input.type='file';input.id='qa-files';input.multiple=true;input.hidden=true;document.body.appendChild(input);}",
  );
  win.webContents.debugger.attach('1.3');
  const document = await win.webContents.debugger.sendCommand('DOM.getDocument');
  const input = await win.webContents.debugger.sendCommand('DOM.querySelector', {
    nodeId: document.root.nodeId,
    selector: '#qa-files',
  });
  await win.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
    nodeId: input.nodeId,
    files: [editPath],
  });
  const importDraft = unwrap(
    await js(
      `window.versions.drop(${asset},Array.from(document.querySelector('#qa-files').files))`,
    ),
  );
  const dropped = unwrap(
    await js(
      `window.manager.dropBatch(${id},Array.from(document.querySelector('#qa-files').files))`,
    ),
  );
  assert.equal(dropped.length, 1);
  unwrap(await js('window.manager.discardBatch()'));
  await win.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
    nodeId: input.nodeId,
    files: [editPath, path.join(game, 'img/pictures/a.png')],
  });
  assert.equal(
    (
      await js(
        `window.versions.drop(${asset},Array.from(document.querySelector('#qa-files').files))`,
      )
    ).ok,
    false,
  );
  win.webContents.debugger.detach();
  await js("document.querySelector('#qa-files').remove()");
  unwrap(await js(`window.versions.commit(${JSON.stringify(importDraft.token)}, true)`));
  unwrap(await js(`window.operations.execute(${id}, 'apply', [], true)`));
  unwrap(await js(`window.versions.select(${asset}, null)`));
  assert.deepEqual(await fs.readFile(path.join(game, 'img/pictures/a.png')), edited);
  win.webContents.reload();
  await sleep(300);
  await click('開啟專案 →');
  await wait("document.body.textContent.includes('原圖 · 待套用')");
  await click('套用到遊戲');
  await wait("document.body.textContent.includes('V1 → 原圖')");
  await wait(
    "document.querySelectorAll('main img').length >= 2 && Array.from(document.querySelectorAll('main img')).every(i=>i.complete && i.naturalWidth > 0)",
  );
  await sleep(300);
  assert(
    await js(
      "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('套用全部待套用圖片')).disabled",
    ),
  );
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'ui-0.5-original.png'), (await captureWindow(win)).toPNG());
  await click('返回工作臺');
  await click('批量匯入圖片');
  await wait("document.body.textContent.includes('批量匯入與配對')");
  assert.equal(await js("document.querySelectorAll('[role=dialog]').length"), 0);
  selected = path.join(game, 'img/pictures');
  await click('選擇圖片資料夾');
  await wait("document.body.textContent.includes('圖片規格一致')");
  await wait(
    "document.querySelectorAll('section img').length >= 2 && Array.from(document.querySelectorAll('section img')).every(i=>i.complete && i.naturalWidth > 0)",
  );
  const layouts = [];
  for (const [width, height] of [
    [1120, 780],
    [800, 600],
  ]) {
    win.setContentSize(width, height);
    await sleep(200);
    assert.equal(await js('document.documentElement.scrollWidth > innerWidth'), false);
    await fs.writeFile(
      path.join(output, `ui-0.5-batch-${width}.png`),
      (await captureWindow(win)).toPNG(),
    );
    layouts.push({ width, height, horizontalOverflow: false });
  }
  await click('返回工作臺');
  unwrap(await js(`window.operations.execute(${id}, 'apply', [], true)`));
  assert.deepEqual(await fs.readFile(path.join(game, 'img/pictures/a.png')), original);
  await fs.writeFile(path.join(game, 'img/pictures/new.png'), original);
  if (process.env.SCAN_UI_QA) {
    await click('重新掃描新增素材');
    await wait("!!document.querySelector('[role=dialog]')");
    await click('確認新增／繼續掃描');
    await wait(
      "document.querySelector('[role=dialog] [role=status]')?.textContent.includes('掃描中…')",
    );
    assert.equal(
      await js(
        "Array.from(document.querySelectorAll('[role=dialog] button')).every(b=>b.disabled)",
      ),
      true,
    );
    assert.equal(
      await js("!!document.querySelector('[role=dialog] [role=status] [aria-hidden=true]')"),
      true,
    );
    await js(
      "Array.from(document.querySelectorAll('[role=dialog] button')).find(b=>b.textContent==='掃描中…').click()",
    );
    assert.equal(scanCalls, 1);
    await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await sleep(150);
    await fs.writeFile(path.join(output, 'scan-busy-800.png'), (await captureWindow(win)).toPNG());
    releaseScan();
    await wait(
      "!document.querySelector('[role=dialog]') && document.body.textContent.includes('掃描結果已保存')",
    );
    assert.equal(await js("document.querySelectorAll('[role=dialog] [role=status]').length"), 0);
  } else {
    const plan = unwrap(await js(`window.catalog.scanPlan(${id})`));
    assert.deepEqual(plan.added, ['img/pictures/new.png']);
    unwrap(await js(`window.catalog.scanCommit(${id},${JSON.stringify(plan.token)})`));
  }
  assert.equal(unwrap(await js(`window.catalog.assets(${id})`)).length, 2);
  await fs.rename(game, path.join(base, 'moved'));
  assert.equal(unwrap(await js(`window.catalog.availability(${id})`)).online, false);
  assert.equal((await js(`window.operations.execute(${id}, 'apply', [], true)`)).ok, false);
  await wait("document.body.textContent.includes('重新連結遊戲位置')");
  selected = path.join(base, 'moved');
  unwrap(await js(`window.manager.relink(${id})`));
  assert.equal(unwrap(await js(`window.catalog.availability(${id})`)).online, true);
  if (process.env.FEATURE_UI_QA) {
    await require('./electron-feature-checks.cjs')({
      win,
      js,
      wait,
      click,
      unwrap,
      output,
      projectId: project.id,
      assetId: assets[0].id,
      base,
      original,
      edited,
      sleep,
      setSelected: (value) => {
        selected = value;
      },
      setDialogResponse: (value) => {
        dialogResponse = value;
      },
      getDialog: () => lastDialog,
    });
  } else if (process.env.NEXT_UI_QA) {
    assert.equal(Menu.getApplicationMenu(), null);
    await require('./electron-next-checks.cjs')({
      win,
      js,
      wait,
      click,
      unwrap,
      output,
      projectId: project.id,
      assetId: assets[0].id,
      base,
      original,
      edited,
      setSelected: (value) => {
        selected = value;
      },
      sleep,
    });
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  await fs.writeFile(
    path.join(output, 'ui-0.5.json'),
    JSON.stringify(
      {
        platform: process.platform,
        electron: process.versions.electron,
        scope:
          'Real Electron main/preload/renderer; generated unencrypted MZ fixture; native dialogs stubbed; real File objects injected via CDP; no real game or OS drag gesture',
        originalApply: true,
        scan: true,
        offlineAndRelink: true,
        batchIndependentPage: true,
        fileBridge: true,
        multiFileDetailRejected: true,
        layouts,
        errors,
      },
      null,
      2,
    ),
  );
  console.log('Electron fixture smoke PASS');
  app.quit();
})().catch((e) => {
  console.error(e);
  app.exit(1);
});
setTimeout(() => {
  console.error('Electron smoke timeout');
  app.exit(1);
}, 90000).unref();
