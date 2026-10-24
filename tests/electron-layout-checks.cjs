const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const captureWindow = require('./electron-capture.cjs');
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
  edited,
  setSelected,
  sleep,
}) => {
  const id = JSON.stringify(projectId),
    asset = JSON.stringify(assetId);
  const group = unwrap(await js(`window.manager.groups(${id})`))[0];
  unwrap(
    await js(`window.manager.changeGroup(${id},${JSON.stringify(group.id)},'add',[${asset}])`),
  );
  const longPath = path.join(base, '長檔名-preview-'.repeat(8) + '.png');
  await fs.writeFile(longPath, edited);
  setSelected(longPath);
  const draft = unwrap(await js(`window.versions.choose(${asset})`));
  unwrap(await js(`window.versions.commit(${JSON.stringify(draft.token)},true)`));
  win.webContents.reload();
  await wait("!!document.querySelector('select[aria-label=Language]')");
  assert.equal(
    await js(
      "!!document.querySelector('select[aria-label=Language]').closest('label').querySelector('svg')",
    ),
    true,
  );
  await click('開啟專案 →');
  await js(
    `Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent.includes(${JSON.stringify(group.name)})).click()`,
  );
  const input = async (name) =>
    js(
      `{const e=document.querySelector('[role=dialog] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(name)});e.dispatchEvent(new Event('input',{bubbles:true}));}`,
    );
  await click('重新命名群組');
  await input('不保存');
  await click('取消');
  assert.equal(unwrap(await js(`window.manager.groups(${id})`))[0].name, group.name);
  await click('重新命名群組');
  await input('改名後群組');
  await click('確認');
  await wait("!document.querySelector('[role=dialog]')");
  const renamed = unwrap(await js(`window.manager.groups(${id})`)).find((g) => g.id === group.id);
  assert.equal(renamed.name, '改名後群組');
  assert.deepEqual(renamed.assetIds, [assetId]);
  const layouts = [];
  for (const [locale, open] of [
    ['en', 'Open project →'],
    ['ja', 'プロジェクトを開く →'],
    ['zh-Hans', '开启项目 →'],
    ['zh-Hant', '開啟專案 →'],
  ]) {
    await js(`localStorage.setItem('raw-locale',${JSON.stringify(locale)})`);
    win.webContents.reload();
    await wait(
      `document.documentElement.lang===${JSON.stringify(locale)} && !!document.querySelector('select[aria-label=Language]')`,
    );
    await click(open);
    await wait(`!!document.querySelector('[data-drop-asset="${assetId}"] button img')`);
    for (const width of [800, 1120]) {
      win.setContentSize(width, 600);
      await sleep(100);
      const gap = await js(
        `{const replacement=document.querySelector('[data-drop-asset="${assetId}"]');Math.abs(replacement.querySelector('button').getBoundingClientRect().top-replacement.previousElementSibling.querySelector('button').getBoundingClientRect().top)}`,
      );
      assert(gap < 1, 'Original and replacement previews must align at the top');
      await js(
        `document.querySelector('[data-drop-asset="${assetId}"]').parentElement.lastElementChild.querySelector('button').click()`,
      );
      await wait("document.querySelectorAll('article [aria-label]').length>=3");
      await js(
        "document.querySelector('article [aria-label]').closest('section').scrollIntoView({block:'start'})",
      );
      await sleep(150);
      const valid =
        await js(`Array.from(document.querySelectorAll('article [aria-label]')).every(preview=>{
        const row=preview.closest('article'), r=row.getBoundingClientRect();
        const children=Array.from(row.children).map(e=>e.getBoundingClientRect());
        return row.scrollWidth<=row.clientWidth && children.every(c=>c.left>=r.left-1 && c.right<=r.right+1) &&
          children.every((a,i)=>children.slice(i+1).every(b=>a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1));
      })`);
      assert(valid, `History must not overlap or overflow (${locale}, ${width})`);
      assert.equal(
        await js(
          'document.documentElement.scrollWidth>innerWidth || document.documentElement.scrollHeight>innerHeight',
        ),
        false,
      );
      await fs.writeFile(
        path.join(output, `history-${locale}-${width}.png`),
        (await captureWindow(win)).toPNG(),
      );
      layouts.push({ locale, width, topAligned: true, historyNoOverlap: true });
      await js("document.querySelector('main > button').click()");
      await wait(`!!document.querySelector('[data-drop-asset="${assetId}"]')`);
    }
  }
  await fs.writeFile(
    path.join(output, 'layout-0.5.1.json'),
    JSON.stringify(
      {
        groupRename: true,
        cancelUnchanged: true,
        membersPreserved: true,
        languageIcon: true,
        layouts,
      },
      null,
      2,
    ),
  );
};
