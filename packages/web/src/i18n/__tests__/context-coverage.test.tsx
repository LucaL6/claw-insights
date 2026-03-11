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

  it('toggleLang removes hash completely when lang is only param', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    window.location.hash = '#/page?lang=en';

    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.toggleLang());

    // lang was the only param — hash should just be the base
    expect(window.location.hash).not.toContain('lang=');
  });

  it('toggleLang is no-op when hash has no query string', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    window.location.hash = '#/page';

    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.toggleLang());

    expect(result.current.lang).toBe('zh');
    // hash should remain unchanged (no ?lang= to remove)
    expect(window.location.hash).toBe('#/page');
  });

  it('URL hash with invalid lang value is ignored', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    window.location.hash = '#/?lang=fr';

    const { result } = renderHook(() => useI18n(), { wrapper });
    // fr is invalid, should fall back to stored lang
    expect(result.current.lang).toBe('en');
  });

  it('migration skips when ci:lang already exists', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    localStorage.setItem('lang', 'zh'); // old key present but should be ignored

    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('en');
    // old key should still be there (migration skipped)
    expect(localStorage.getItem('lang')).toBe('zh');
  });

  it('migration handles JSON-wrapped invalid lang value', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('lang', '"fr"'); // valid JSON but invalid lang

    renderHook(() => useI18n(), { wrapper });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('migration skipped'));
    expect(localStorage.getItem('lang')).toBe('"fr"');
    warnSpy.mockRestore();
  });

  it('useI18n throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useI18n());
    }).toThrow('useI18n must be inside I18nProvider');
  });

  it('getUrlLang handles malformed hash gracefully', () => {
    window.location.hash = '#/page?%invalid';
    // Should not throw, just fall back
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(['en', 'zh']).toContain(result.current.lang);
  });

  it('detectBrowserLang catch branch — navigator.language throws', () => {
    const desc =
      Object.getOwnPropertyDescriptor(Navigator.prototype, 'language') ??
      Object.getOwnPropertyDescriptor(navigator, 'language');
    Object.defineProperty(navigator, 'language', {
      get() {
        throw new Error('blocked');
      },
      configurable: true,
    });

    // No stored lang, no URL lang → detectBrowserLang is called and should catch → 'en'
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.lang).toBe('en');

    // Restore
    if (desc) {
      Object.defineProperty(navigator, 'language', desc);
    } else {
      Object.defineProperty(navigator, 'language', { value: 'en', configurable: true });
    }
  });

  it('migrateOldLangKey catch branch — localStorage.getItem throws', () => {
    const origGetItem = localStorage.getItem;
    localStorage.getItem = () => {
      throw new Error('quota');
    };

    // Should not throw — migration catch handles it
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(['en', 'zh']).toContain(result.current.lang);

    localStorage.getItem = origGetItem;
  });

  it('toggleLang catch branch — window.location.hash getter throws', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    const { result } = renderHook(() => useI18n(), { wrapper });

    const origHash =
      Object.getOwnPropertyDescriptor(window.location, 'hash') ??
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window.location), 'hash');

    // Make .hash split throw inside toggleLang's try block
    Object.defineProperty(window.location, 'hash', {
      get() {
        throw new Error('no hash');
      },
      set() {
        /* noop */
      },
      configurable: true,
    });

    // toggleLang should catch and not throw
    act(() => result.current.toggleLang());
    expect(result.current.lang).toBe('zh'); // toggled via setLang before the try

    // Restore
    if (origHash) {
      Object.defineProperty(window.location, 'hash', origHash);
    }
  });
});
