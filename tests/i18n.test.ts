import { it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { t, setLocale, messages, isLocale } from '../src/shared/i18n';
import { simplify } from '../src/shared/messages';
afterEach(() => setLocale('zh-Hant'));
it('translates all four locales while preserving user data in placeholders', () => {
  for (const locale of ['zh-Hant', 'zh-Hans', 'en', 'ja'] as const) {
    setLocale(locale);
    const name = '原圖 / 日本語 🌙';
    expect(t('新增素材至群組「{0}」', [name])).toContain(name);
    expect(t('新增素材至群組「{0}」', [name])).not.toContain('{0}');
  }
  setLocale('en');
  expect(t('專案名稱')).toBe('Project name');
  expect(t('圖片 9000 × 9000 超過安全上限 33554432 像素')).toBe(
    'Image 9000 × 9000 exceeds the hard limit of 33554432 pixels',
  );
  expect(t('Error: 偵測外部變更，禁止覆蓋')).toContain('External change');
  expect(t('原始備份損壞：D:/原圖.png')).toBe('Original backup is damaged:D:/原圖.png');
  expect(t('透明通道：有 → 無')).toBe('Alpha channel: Yes → None');
  setLocale('zh-Hans');
  expect(t('專案名稱')).toBe('项目名称');
  setLocale('ja');
  expect(t('專案名稱')).toBe('プロジェクト名');
  expect(isLocale('de')).toBe(false);
});
it('every translation has matching placeholder indexes and nonempty text', () => {
  for (const [key, translations] of Object.entries(messages)) {
    const slots = (s: string) => [...s.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();
    for (const text of translations) {
      expect(text, key).toBeTruthy();
      expect(slots(text), key).toEqual(slots(key));
    }
  }
});
it('all static translation calls in the shipped UI and IPC have dictionary entries', () => {
  const files = readdirSync('src/renderer')
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => 'src/renderer/' + f)
    .concat('src/main/index.ts');
  const missing = new Set<string>();
  for (const file of files) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      const key = m[1].replaceAll("\\'", "'").replaceAll('\\n', '\n').trim();
      if (/[\u3400-\u9fff]/.test(key) && !messages[key]) missing.add(key);
    }
  }
  expect([...missing]).toEqual([]);
});
it('simplified terminology uses user-facing regional vocabulary', () => {
  expect(simplify('專案檔案匯入匯出記憶體')).toBe('项目文件导入导出内存');
});
