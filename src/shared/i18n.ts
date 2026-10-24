import { messages as uiMessages, simplify } from './messages';
import { errorMessages } from './error-messages';
export const messages = { ...uiMessages, ...errorMessages };
export const locales = ['zh-Hant', 'zh-Hans', 'en', 'ja'] as const;
export type Locale = (typeof locales)[number];
export function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}
let locale: Locale = 'zh-Hant';
try {
  const saved = globalThis.localStorage?.getItem('raw-locale');
  if (isLocale(saved)) locale = saved;
} catch {}
export const getLocale = () => locale;
export function setLocale(value: Locale) {
  if (!isLocale(value)) throw Error('Invalid locale');
  locale = value;
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.keys(messages)
  .filter((k) => /\{\d+\}/.test(k))
  .map((key) => {
    const indexes: number[] = [];
    const parts = key.split(/(\{\d+\})/g).map((p) => {
      if (/^\{\d+\}$/.test(p)) {
        indexes.push(Number(p.slice(1, -1)));
        return '([\\s\\S]*?)';
      }
      return escape(p);
    });
    return { key, indexes, regex: new RegExp('^' + parts.join('') + '$') };
  });
function format(text: string, args: unknown[]) {
  return text.replace(/\{(\d+)\}/g, (match, i) => (i in args ? String(args[i]) : match));
}
/** Only application-owned messages are translated; user names/paths are passed as parameters. */
export function t(source: string, args: unknown[] = []): string {
  const key = source.trim();
  if (locale === 'zh-Hant') return format(source, args);
  if (key === '透明通道：{0} → {1}') args = args.map((v) => t(String(v)));
  const found = messages[key];
  if (found) {
    const text = locale === 'zh-Hans' ? simplify(key) : found[locale === 'en' ? 0 : 1];
    return (
      source.slice(0, source.indexOf(key)) +
      format(text, args) +
      source.slice(source.indexOf(key) + key.length)
    );
  }
  if (args.length) return format(source, args);
  if (source.startsWith('Error: ')) return t(source.slice(7));
  for (const p of patterns) {
    const m = p.regex.exec(key);
    if (m) {
      const values: unknown[] = [];
      p.indexes.forEach((n, i) => (values[n] = m[i + 1]));
      return t(p.key, values);
    }
  }
  // Composed domain errors append paths or an OS error after a fixed prefix.
  for (const prefix of Object.keys(messages)
    .filter((k) => /[：:]$/.test(k))
    .sort((a, b) => b.length - a.length))
    if (source.startsWith(prefix)) return t(prefix) + source.slice(prefix.length);
  return source; // Unknown OS diagnostics may contain user paths; never transliterate them.
}
