import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import en from './en.json';
import zh from './zh.json';

type Lang = 'en' | 'zh';

const dictionaries: Record<Lang, Record<string, string>> = { en, zh };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    // URL param override (for screenshot API) — params may be in hash query
    const hashQs = window.location.hash.split('?')[1] ?? '';
    const urlLang = new URLSearchParams(hashQs).get('lang');
    if (urlLang === 'en' || urlLang === 'zh') return urlLang;
    const stored = localStorage?.getItem?.('lang');
    if (stored === 'en' || stored === 'zh') return stored;
    return navigator.language.startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('lang', l);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'zh' : 'en');
  }, [lang, setLang]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = dictionaries[lang][key] ?? dictionaries['en'][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }, [lang]);

  return (
    <I18nContext value={{ lang, setLang, toggleLang, t }}>
      {children}
    </I18nContext>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be inside I18nProvider');
  return ctx;
}
