import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { usePreference } from '../hooks/usePreference';
import en from './en.json';
import zh from './zh.json';

type Lang = 'en' | 'zh';

const dictionaries: Record<Lang, Record<string, string>> = { en, zh };
const VALID_LANGS: Lang[] = ['en', 'zh'];

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Parse a stored value as Lang — tries JSON first, then legacy plain string */
function parseOldLang(raw: string): Lang | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string' && VALID_LANGS.includes(parsed as Lang)) {
      return parsed as Lang;
    }
  } catch {
    // Not valid JSON — fall through to legacy plain string
  }
  if (VALID_LANGS.includes(raw as Lang)) return raw as Lang;
  return null;
}

/** Migrate old 'lang' key → 'ci:lang' (idempotent, one-time) */
function migrateOldLangKey(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem('ci:lang') !== null) return;
    const raw = localStorage.getItem('lang');
    if (raw === null) return;
    const parsed = parseOldLang(raw);
    if (parsed !== null) {
      localStorage.setItem('ci:lang', JSON.stringify(parsed));
      localStorage.removeItem('lang');
    } else {
      console.warn(`[i18n] migration skipped: invalid old value "${raw}"`);
    }
  } catch {
    // best effort — preserve old key
  }
}

function getUrlLang(): Lang | null {
  if (typeof window === 'undefined') return null;
  try {
    const hashQs = window.location.hash.split('?')[1] ?? '';
    const urlLang = new URLSearchParams(hashQs).get('lang');
    if (VALID_LANGS.includes(urlLang as Lang)) return urlLang as Lang;
  } catch {
    // ignore
  }
  return null;
}

function detectBrowserLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    return navigator.language.startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Run migration before usePreference reads the key
  migrateOldLangKey();

  const urlLang = getUrlLang();

  const [storedLang, setStoredLang] = usePreference<Lang>('lang', detectBrowserLang(), {
    validate: (v) => VALID_LANGS.includes(v),
  });

  const lang = urlLang ?? storedLang;

  const setLang = useCallback(
    (l: Lang) => {
      setStoredLang(l);
    },
    [setStoredLang],
  );

  const toggleLang = useCallback(() => {
    const next = lang === 'en' ? 'zh' : 'en';
    setLang(next);
    // Clear URL lang param so it doesn't override the toggled value
    try {
      const [base, qs] = window.location.hash.split('?');
      if (qs) {
        const params = new URLSearchParams(qs);
        if (params.has('lang')) {
          params.delete('lang');
          const newHash = params.toString() ? `${base}?${params}` : base;
          window.history.replaceState(null, '', newHash || '#');
        }
      }
    } catch {
      // best effort
    }
  }, [lang, setLang]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = dictionaries[lang][key] ?? dictionaries['en'][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang],
  );

  return <I18nContext value={{ lang, setLang, toggleLang, t }}>{children}</I18nContext>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be inside I18nProvider');
  return ctx;
}
