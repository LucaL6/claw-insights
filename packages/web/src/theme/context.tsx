import { createContext, type ReactNode,useCallback, useContext, useEffect } from 'react';

import { usePreference } from '../hooks/usePreference';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const VALID_THEMES: Theme[] = ['dark', 'light'];

/** Parse a stored value as Theme — tries JSON first, then legacy plain string */
function parseOldTheme(raw: string): Theme | null {
  // Try JSON parse first (e.g. '"dark"')
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string' && VALID_THEMES.includes(parsed as Theme)) {
      return parsed as Theme;
    }
  } catch {
    // Not valid JSON — fall through to legacy plain string
  }
  // Legacy plain string (e.g. 'dark')
  if (VALID_THEMES.includes(raw as Theme)) {return raw as Theme;}
  return null;
}

/** Migrate old 'theme' key → 'ci:theme' (idempotent, one-time) */
function migrateOldThemeKey(): void {
  if (typeof window === 'undefined') {return;}
  try {
    if (localStorage.getItem('ci:theme') !== null) {return;}
    const raw = localStorage.getItem('theme');
    if (raw === null) {return;}
    const parsed = parseOldTheme(raw);
    if (parsed !== null) {
      localStorage.setItem('ci:theme', JSON.stringify(parsed));
      localStorage.removeItem('theme');
    } else {
      console.warn(`[theme] migration skipped: invalid old value "${raw}"`);
    }
  } catch {
    // best effort — preserve old key
  }
}

function getUrlTheme(): Theme | null {
  if (typeof window === 'undefined') {return null;}
  try {
    const hashQs = window.location.hash.split('?')[1] ?? '';
    const urlTheme = new URLSearchParams(hashQs).get('theme');
    if (VALID_THEMES.includes(urlTheme as Theme)) {return urlTheme as Theme;}
  } catch {
    // ignore
  }
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Run migration before usePreference reads the key
  migrateOldThemeKey();

  const urlTheme = getUrlTheme();

  const [storedTheme, setStoredTheme] = usePreference<Theme>('theme', 'dark', {
    validate: (v) => VALID_THEMES.includes(v),
  });

  // URL param takes priority but doesn't persist
  const theme = urlTheme ?? storedTheme;

  const setTheme = useCallback(
    (t: Theme) => {
      setStoredTheme(t);
      document.documentElement.setAttribute('data-theme', t);
    },
    [setStoredTheme],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <ThemeContext value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {throw new Error('useTheme must be inside ThemeProvider');}
  return ctx;
}
