import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider, useI18n } from '../context';

if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k in store) {
        delete store[k];
      }
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
});

describe('i18n coverage delta', () => {
  it('toggleLang clears ?lang= param from URL hash', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    window.location.hash = '#/page?lang=en&foo=bar';

    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.toggleLang());

    // lang param should be removed, foo should remain
    expect(window.location.hash).toContain('foo=bar');
    expect(window.location.hash).not.toContain('lang=');
  });

  it('t() interpolates {name} params', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    const { result } = renderHook(() => useI18n(), { wrapper });
    // Use a key that won't exist — falls back to key itself, then interpolation replaces {name}
    const text = result.current.t('hello {name}!', { name: 'World' });
    expect(text).toBe('hello World!');
  });

  it('t() falls back to en when key missing in current lang', () => {
    localStorage.setItem('ci:lang', JSON.stringify('zh'));
    const { result } = renderHook(() => useI18n(), { wrapper });
    // nav.dashboard exists in both, so for zh it should return the zh value (not the key string)
    const text = result.current.t('nav.dashboard');
    expect(text).toBe('仪表盘');
    expect(text).not.toBe('nav.dashboard');
  });

  it('migration warns for invalid non-JSON lang value', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('lang', 'invalid-lang');

    renderHook(() => useI18n(), { wrapper });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('migration skipped'));
    // old key preserved
    expect(localStorage.getItem('lang')).toBe('invalid-lang');
    warnSpy.mockRestore();
  });

  it('detectBrowserLang returns zh for zh-CN navigator.language', () => {
    const original = navigator.language;
    Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true });

    // No ci:lang set, no URL lang — should detect zh from browser
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('zh');

    Object.defineProperty(navigator, 'language', { value: original, configurable: true });
  });
});
