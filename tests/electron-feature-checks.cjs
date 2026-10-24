const captureWindow = require('./electron-capture.cjs');
const fs = require('node:fs/promises'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  sharp = require('sharp');
module.exports = async ({
  win,
  js,
  wait,
  click,
  unwrap,
  output,
  projectId,
  assetId,
  base,
  original,
  edited,
  sleep,
  setSelected,
  setDialogResponse,
  getDialog,
}) => {
  const id = JSON.stringify(projectId),
    asset = JSON.stringify(assetId),
    results = [];
  const capture = async (name) => {
    await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    await sleep(100);
    assert.equal(await js('document.documentElement.scrollWidth>innerWidth'), false);
    assert.equal(await js('document.documentElement.scrollHeight>innerHeight'), false);
    assert.equal(await js('document.body.scrollHeight>innerHeight'), false);
    assert.equal(await js('getComputedStyle(document.body).margin'), '0px');
    assert.equal(
      await js(`Array.from(document.querySelectorAll('*')).filter(el =>
      /auto|scroll/.test(getComputedStyle(el).overflowY)).every(el =>
      getComputedStyle(el).scrollbarWidth === 'thin')`),
      true,
    );
    await fs.writeFile(path.join(output, name + '.png'), (await captureWindow(win)).toPNG());
  };
  const largePath = path.join(base, 'large.png');
  await fs.writeFile(
    largePath,
    await sharp({ create: { width: 4097, height: 4096, channels: 4, background: '#697f96' } })
      .png()
      .toBuffer(),
  );
  unwrap(await js(`window.manager.createGroup(${id},'原圖')`));
  win.webContents.reload();
  await sleep(300);
  await wait("!!document.querySelector('select[aria-label=Language]')");
  const cases = [
    {
      locale: 'en',
      home: 'Game projects',
      open: 'Open project →',
      back: '← Projects',
      settings: 'Project settings',
      cancel: 'Cancel',
      large: 'Confirm large image processing',
      group: 'Group name must be',
    },
    {
      locale: 'ja',
      home: 'ゲームプロジェクト',
      open: 'プロジェクトを開く →',
      back: '← プロジェクト一覧',
      settings: 'プロジェクト設定',
      cancel: 'キャンセル',
      large: '大きな画像の処理を確認',
      group: 'グループ名は',
    },
    {
      locale: 'zh-Hans',
      home: '游戏项目',
      open: '开启项目 →',
      back: '← 项目首页',
      settings: '项目设定',
      cancel: '取消',
      large: '确认大图处理',
      group: '群组名称需为',
    },
    {
      locale: 'zh-Hant',
      home: '遊戲專案',
      open: '開啟專案 →',
      back: '← 專案首頁',
      settings: '專案設定',
      cancel: '取消',
      large: '確認大圖處理',
      group: '群組名稱需為',
    },
  ];
  for (const c of cases) {
    await js(
      `{const select=document.querySelector('select[aria-label=Language]');select.value=${JSON.stringify(c.locale)};select.dispatchEvent(new Event('change',{bubbles:true}));}`,
    );
    await sleep(250);
    await wait(
      `document.documentElement.lang===${JSON.stringify(c.locale)} && document.body.textContent.includes(${JSON.stringify(c.home)})`,
    );
    assert.equal(await js("localStorage.getItem('raw-locale')"), c.locale);
    assert.equal(await js('document.title'), 'R-aW — RPG Asset Workbench');
    assert.equal(await js("document.querySelector('header strong').textContent"), 'R-aW');
    assert.equal(await js("document.querySelector('header strong').closest('button')"), null);
    assert.equal(unwrap(await js('window.catalog.projects()'))[0].name, '自製測試專案');
    win.setContentSize(1120, 780);
    await capture('home-' + c.locale);
    await click(c.open);
    await wait("document.querySelectorAll('[data-drop-asset]').length===2");
    assert(
      await js("document.querySelector('aside').textContent.includes('原圖')"),
      'User group names are never translated',
    );
    win.setContentSize(800, 600);
    await capture('workbench-' + c.locale);
    await click(c.settings);
    await wait("document.querySelectorAll('[role=dialog]').length===1");
    await capture('settings-' + c.locale);
    await click(c.cancel);
    const invalid = await js(`window.manager.createGroup(${id},'')`);
    assert.equal(invalid.ok, false);
    assert(invalid.error.includes(c.group), invalid.error);
    setSelected(largePath);
    setDialogResponse(0);
    const cancelled = await js(`window.versions.choose(${asset})`);
    assert.equal(cancelled.ok, false);
    assert.equal(getDialog().message, c.large);
    assert.equal(unwrap(await js(`window.versions.state(${asset})`)).versions.length, 1);
    await click(c.back);
    results.push({
      locale: c.locale,
      home: true,
      settings: true,
      nativeWarning: true,
      translatedError: true,
      userNamesPreserved: true,
    });
  }
  // Actual File objects go through webUtils and the real main/preload bridge.
  await click('開啟專案 →');
  await wait("document.querySelectorAll('[data-drop-asset]').length===2");
  await js(
    "{const i=document.createElement('input');i.type='file';i.id='drop-test-files';i.multiple=true;i.hidden=true;document.body.appendChild(i);}",
  );
  win.webContents.debugger.attach('1.3');
  const doc = await win.webContents.debugger.sendCommand('DOM.getDocument');
  const node = await win.webContents.debugger.sendCommand('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: '#drop-test-files',
  });
  const drop = async (files, selector) => {
    await win.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
      nodeId: node.nodeId,
      files,
    });
    await js(
      `{const dt=new DataTransfer();for(const file of document.querySelector('#drop-test-files').files)dt.items.add(file);document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}`,
    );
  };
  const target = `[data-drop-asset="${assetId}"]`,
    incoming = path.join(base, 'edited.png');
  await drop([incoming], 'main');
  await wait("document.body.textContent.includes('請將單張圖片拖到')");
  assert.equal(await js("document.querySelectorAll('[role=dialog]').length"), 0);
  await drop([incoming], target);
  await wait("document.querySelector('[role=dialog]')?.textContent.includes('確認匯入')");
  await capture('single-drop-confirm');
  await click('取消');
  await wait("!document.querySelector('[role=dialog]')");
  assert.equal(unwrap(await js(`window.versions.state(${asset})`)).versions.length, 1);
  await drop([incoming], target);
  await click('確認匯入');
  await wait("!document.querySelector('[role=dialog]')");
  assert.equal(unwrap(await js(`window.versions.state(${asset})`)).versions.length, 2);
  assert.deepEqual(await fs.readFile(path.join(base, 'moved/img/pictures/a.png')), original);
  await wait(`!!document.querySelector(${JSON.stringify(target + ' button img')})`);
  await js(`document.querySelector(${JSON.stringify(target + ' button')}).click()`);
  await wait("document.querySelector('[role=dialog]')?.textContent.includes('V2')");
  await capture('replacement-preview');
  await js("document.querySelector('[aria-label=關閉彈窗]').click()");
  await wait("!document.querySelector('[role=dialog]')");
  await js("document.querySelector('article button').click()");
  await wait("document.querySelector('[role=dialog]')?.textContent.includes('原圖')");
  await js("document.querySelector('[aria-label=關閉彈窗]').click()");
  const unmatched = path.join(base, 'unmatched.png');
  await fs.writeFile(unmatched, edited);
  await drop([incoming, unmatched], target);
  await wait("document.body.textContent.includes('批量匯入與配對')");
  await wait(
    "document.querySelectorAll('button[aria-label^=放大匯入圖片] img').length===2 && Array.from(document.querySelectorAll('button[aria-label^=放大匯入圖片] img')).every(i=>i.naturalWidth>0)",
  );
  await capture('unmatched-batch-previews');
  await js("document.querySelector('button[aria-label^=放大匯入圖片]').click()");
  await wait("!!document.querySelector('[role=dialog]')");
  await js("document.querySelector('[aria-label=關閉彈窗]').click()");
  await click('返回工作臺');
  assert.equal(unwrap(await js(`window.versions.state(${asset})`)).versions.length, 2);
  win.webContents.debugger.detach();
  await js("document.querySelector('#drop-test-files').remove()");
  setSelected(largePath);
  setDialogResponse(1);
  const start = Date.now(),
    draft = unwrap(await js(`window.versions.choose(${asset})`));
  assert.equal(draft.preview.width, 4097);
  unwrap(await js(`window.versions.discard(${JSON.stringify(draft.token)})`));
  setDialogResponse(0);
  await fs.writeFile(
    path.join(output, 'feature-checks.json'),
    JSON.stringify(
      {
        locales: results,
        regularLimit: 16777216,
        hardLimit: 33554432,
        largePreviewMs: Date.now() - start,
        singleDropConfirm: true,
        cancelDoesNotImport: true,
        multipleDropBatch: true,
        unmatchedPreview: true,
        listEnlarge: true,
        gameUnchanged: true,
        scope:
          'Generated MZ fixture; native dialogs stubbed; real File objects and DOM drop events; no OS drag gesture or user game',
      },
      null,
      2,
    ),
  );
};
