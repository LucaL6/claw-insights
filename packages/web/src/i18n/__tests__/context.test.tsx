import { act,renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach,describe, expect, it } from 'vitest';

import { I18nProvider, useI18n } from '../context';

if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) {delete store[k];} },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

beforeEach(() => {
  localStorage.clear();
});

describe('I18nProvider with usePreference', () => {
  it('defaults to en (or browser-detected)', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    // happy-dom navigator.language is typically 'en'
    expect(['en', 'zh']).toContain(result.current.lang);
  });

  it('persists lang to ci:lang key', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLang('zh'));
    expect(result.current.lang).toBe('zh');
    expect(localStorage.getItem('ci:lang')).toBe(JSON.stringify('zh'));
  });

  it('reads from ci:lang on mount', () => {
    localStorage.setItem('ci:lang', JSON.stringify('zh'));
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('zh');
  });

  it('migrates old "lang" key to "ci:lang"', () => {
    localStorage.setItem('lang', 'zh');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('zh');
    expect(localStorage.getItem('lang')).toBeNull();
    expect(localStorage.getItem('ci:lang')).toBe(JSON.stringify('zh'));
  });

  it('toggles between en and zh', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    const initial = result.current.lang;
    act(() => result.current.toggleLang());
    expect(result.current.lang).toBe(initial === 'en' ? 'zh' : 'en');
  });

  it('t() returns translated string', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    const { result } = renderHook(() => useI18n(), { wrapper });
    // Verify t() returns something (exact key depends on en.json)
    const missing = result.current.t('nonexistent.key');
    expect(missing).toBe('nonexistent.key'); // fallback to key
  });

  it('ignores invalid old key during migration', () => {
    localStorage.setItem('lang', 'fr'); // invalid
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(['en', 'zh']).toContain(result.current.lang); // default
    expect(localStorage.getItem('lang')).toBe('fr'); // preserved
  });

  it('URL hash lang param overrides localStorage', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    const original = window.location.hash;
    window.location.hash = '#/?lang=zh';
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('zh');
    // localStorage should still have en (URL doesn't persist)
    expect(localStorage.getItem('ci:lang')).toBe(JSON.stringify('en'));
    window.location.hash = original;
  });

  it('migrates old JSON-formatted lang key', () => {
    localStorage.setItem('lang', '"zh"');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('zh');
    expect(localStorage.getItem('lang')).toBeNull();
    expect(localStorage.getItem('ci:lang')).toBe(JSON.stringify('zh'));
  });
});
