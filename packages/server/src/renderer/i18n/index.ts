import { messages } from './messages.js';

export type Locale = 'en' | 'zh';

const SUPPORTED: Set<string> = new Set(Object.keys(messages));
const FALLBACK: Locale = 'en';
const ALIASES: Record<string, Locale> = {
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hk': 'zh',
};

export function resolveLocale(locale: string): Locale {
  if (SUPPORTED.has(locale)) {
    return locale as Locale;
  }
  const lower = locale.toLowerCase();
  if (ALIASES[lower]) {
    return ALIASES[lower];
  }
  return FALLBACK;
}

export function t(key: string, locale: string, vars?: Record<string, string>): string {
  const resolved = resolveLocale(locale);
  let text = messages[resolved]?.[key] ?? messages[FALLBACK]?.[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}

export function formatRange(range: string, locale: string): string {
  const resolved = resolveLocale(locale);
  const key = `range.${range}`;
  return messages[resolved]?.[key] ?? messages[FALLBACK]?.[key] ?? range;
}
