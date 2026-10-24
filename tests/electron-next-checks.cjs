const captureWindow = require('./electron-capture.cjs');
// Additional UI acceptance on the existing isolated Electron fixture; never a user game.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
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
  setSelected,
  sleep,
}) => {
  const id = JSON.stringify(projectId),
    asset = JSON.stringify(assetId);
  const setInput = async (selector, text) =>
    js(
      `{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event('input',{bubbles:true}));}`,
    );
  const capture = async (name) => {
    await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await sleep(150);
    assert.equal(await js('document.documentElement.scrollWidth > innerWidth'), false);
    await fs.writeFile(path.join(output, name + '.png'), (await captureWindow(win)).toPNG());
  };
  await click('← 專案首頁');
  assert.equal(await js("document.body.textContent.includes('環境檢查')"), false);
  assert.equal(
    await js(
      "Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()==='＋ 建立專案').length",
    ),
    1,
  );
  assert.equal(await js("!!document.querySelector('select[aria-label=切換專案]')"), false);
  await click('開啟專案 →');
  await click('專案設定');
  await setInput('input[aria-label="專案名稱"]', '新版測試專案');
  await click('從專案素材選擇');
  await js(
    "Array.from(document.querySelectorAll('[role=dialog]')).at(-1).querySelector('input[type=radio]').click()",
  );
  await click('選擇封面');
  await capture('settings-800');
  await click('儲存變更');
  await wait("document.querySelectorAll('[role=dialog]').length===0");
  assert.equal(unwrap(await js('window.catalog.projects()'))[0].name, '新版測試專案');
  assert.equal(unwrap(await js(`window.manager.cover(${id})`)).width, 400);
  await click('專案設定');
  setSelected(path.join(base, 'edited.png'));
  await click('匯入封面圖片');
  await wait("document.querySelector('[role=dialog] img')?.complete");
  await click('儲存變更');
  await wait("document.querySelectorAll('[role=dialog]').length===0");
  const cover = unwrap(await js(`window.manager.cover(${id})`));
  await click('專案設定');
  await setInput('input[aria-label="專案名稱"]', '不應保存');
  await click('恢復預設封面');
  await click('取消');
  assert.equal(unwrap(await js('window.catalog.projects()'))[0].name, '新版測試專案');
  assert.equal(unwrap(await js(`window.manager.cover(${id})`)).sha256, cover.sha256);
  // Create a group, then use the picker rather than the selected-row shortcut.
  await click('＋ 建立群組');
  await setInput('[role=dialog] input', '測試群組');
  await click('確認');
  await wait("document.querySelectorAll('[role=dialog]').length===0");
  await js(
    "Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent.includes('測試群組')).click()",
  );
  await click('＋ 新增素材');
  await js("document.querySelector('[role=dialog] input[type=checkbox]').click()");
  await click('取消');
  assert.equal(unwrap(await js(`window.manager.groups(${id})`))[0].assetIds.length, 0);
  await click('＋ 新增素材');
  await js("document.querySelector('[role=dialog] input[type=checkbox]').click()");
  await capture('group-picker-800');
  await click('加入素材');
  await wait("document.querySelectorAll('[role=dialog]').length===0");
  assert.equal(unwrap(await js(`window.manager.groups(${id})`))[0].assetIds.length, 1);
  await click('＋ 新增素材');
  assert.equal(
    await js("document.querySelectorAll('[role=dialog] input[type=checkbox]:disabled').length"),
    1,
  );
  await click('取消');
  await js(
    "Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent.includes('原始資料夾')).click()",
  );
  assert.equal(
    await js(
      "Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent.includes('原始資料夾')).getAttribute('aria-expanded')",
    ),
    'false',
  );
  await click('← 專案首頁');
  await click('開啟專案 →');
  assert.equal(
    await js(
      "Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent.includes('原始資料夾')).getAttribute('aria-expanded')",
    ),
    'false',
  );
  await js(
    "Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent.includes('原始資料夾')).click()",
  );
  await js('document.querySelector(\'button[aria-label="展開收合 img"]\').click()');
  assert.equal(await js('document.querySelector(\'button[title="img/pictures"]\')===null'), true);
  await js('document.querySelector(\'button[aria-label="展開收合 img"]\').click()');
  // Prepare a pending version; check both independent row actions and history retention.
  setSelected(path.join(base, 'edited.png'));
  let draft = unwrap(await js(`window.versions.choose(${asset})`));
  unwrap(await js(`window.versions.commit(${JSON.stringify(draft.token)},true)`));
  await click('← 專案首頁');
  await click('開啟專案 →');
  await click('取消待套用');
  await click('確認取消待套用');
  await wait("document.querySelectorAll('[role=dialog]').length===0");
  let st = unwrap(await js(`window.versions.state(${asset})`));
  assert.equal(st.active, st.deployed);
  assert.equal(st.versions.length, 2);
  unwrap(await js(`window.versions.select(${asset},${JSON.stringify(st.versions[0].id)})`));
  await click('← 專案首頁');
  await click('開啟專案 →');
  await click('刪除版本');
  await click('永久刪除版本');
  await wait("document.querySelectorAll('[role=dialog]').length===0");
  st = unwrap(await js(`window.versions.state(${asset})`));
  assert.equal(st.active, st.deployed);
  assert.equal(st.versions.length, 1);
  assert.deepEqual(await fs.readFile(path.join(base, 'moved/img/pictures/a.png')), original);
  await capture('workbench-800');
  await click('詳細內容 →');
  await wait(`!!document.querySelector('button[aria-label="預覽 V1"]')`);
  await js(
    `document.querySelector('button[aria-label="預覽 V1"]').scrollIntoView({block:'center'})`,
  );
  await wait('document.querySelector(\'button[aria-label="預覽 V1"] img\')?.naturalWidth > 0');
  await js('document.querySelector(\'button[aria-label="預覽 V1"]\').click()');
  await wait("document.querySelectorAll('[role=dialog]').length===1");
  const bounds = await js(
    "{const r=document.querySelector('[role=dialog]').getBoundingClientRect();({w:r.width,h:r.height,iw:innerWidth,ih:innerHeight});}",
  );
  assert.equal(bounds.w, bounds.iw);
  assert.equal(bounds.h, bounds.ih);
  await capture('viewer-800');
  await js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await wait("document.querySelectorAll('[role=dialog]').length===0");
  await click('← 專案首頁');
  win.setContentSize(1120, 780);
  await capture('home-1120');
  // Keep a deployed fixture image when permanently deleting the tool project.
  unwrap(await js(`window.versions.select(${asset},${JSON.stringify(st.versions[0].id)})`));
  unwrap(await js(`window.operations.execute(${id},'apply',[],true)`));
  await click('刪除專案');
  await wait("document.querySelector('[role=dialog] input[type=checkbox]')!==null");
  assert.equal(
    await js(
      "Array.from(document.querySelectorAll('[role=dialog] button')).find(b=>b.textContent==='永久刪除').disabled",
    ),
    true,
  );
  await click('取消');
  assert.equal(unwrap(await js('window.catalog.projects()')).length, 1);
  await click('刪除專案');
  await capture('delete-project-1120');
  await js("document.querySelector('[role=dialog] input[type=checkbox]').click()");
  await click('永久刪除');
  await wait("document.body.textContent.includes('尚無遊戲專案')");
  assert.deepEqual(unwrap(await js('window.catalog.projects()')), []);
  assert.deepEqual(await fs.readFile(path.join(base, 'moved/img/pictures/a.png')), edited);
  assert.deepEqual(await fs.readFile(path.join(base, 'moved/img/pictures/new.png')), original);
  await assert.rejects(fs.stat(path.join(base, 'userData/projects', projectId)));
  await fs.writeFile(
    path.join(output, 'next-checks.json'),
    JSON.stringify(
      {
        projectSettings: true,
        cover: true,
        groupPicker: true,
        collapsePersistence: true,
        cancelPending: true,
        deletePending: true,
        historyThumbnail: true,
        fullWindowPreview: true,
        projectDeletion: true,
        gamePreserved: true,
        menuRemoved: true,
        scope: 'isolated fixture; dialogs stubbed; no real game',
      },
      null,
      2,
    ),
  );
};
