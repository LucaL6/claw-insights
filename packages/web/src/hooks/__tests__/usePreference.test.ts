import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePreference } from '../usePreference';

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

beforeEach(() => {
  localStorage.clear();
});

describe('usePreference', () => {
  it('returns defaultValue when nothing stored', () => {
    const { result } = renderHook(() => usePreference('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('reads existing value from localStorage', () => {
    localStorage.setItem('ci:test-key', JSON.stringify('stored'));
    const { result } = renderHook(() => usePreference('test-key', 'default'));
    expect(result.current[0]).toBe('stored');
  });

  it('writes to localStorage on set', () => {
    const { result } = renderHook(() => usePreference('test-key', 'default'));
    act(() => result.current[1]('updated'));
    expect(result.current[0]).toBe('updated');
    expect(localStorage.getItem('ci:test-key')).toBe(JSON.stringify('updated'));
  });

  it('supports functional updater', () => {
    const { result } = renderHook(() => usePreference('count', 0));
    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(1);
  });

  it('falls back to defaultValue on invalid JSON', () => {
    localStorage.setItem('ci:bad', 'not-json{{{');
    const { result } = renderHook(() => usePreference('bad', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('falls back to defaultValue when validate rejects', () => {
    localStorage.setItem('ci:validated', JSON.stringify('invalid'));
    const { result } = renderHook(() =>
      usePreference('validated', 'ok', {
        validate: (v) => v === 'ok' || v === 'also-ok',
      }),
    );
    expect(result.current[0]).toBe('ok');
  });

  it('accepts value when validate passes', () => {
    localStorage.setItem('ci:validated', JSON.stringify('also-ok'));
    const { result } = renderHook(() =>
      usePreference('validated', 'ok', {
        validate: (v) => v === 'ok' || v === 'also-ok',
      }),
    );
    expect(result.current[0]).toBe('also-ok');
  });

  it('uses custom serialize/deserialize', () => {
    const { result } = renderHook(() =>
      usePreference('custom', new Date('2026-01-01'), {
        serialize: (d) => d.toISOString(),
        deserialize: (s) => new Date(s),
      }),
    );
    act(() => result.current[1](new Date('2026-06-15')));
    expect(localStorage.getItem('ci:custom')).toBe('2026-06-15T00:00:00.000Z');
  });

  it('handles boolean values correctly', () => {
    const { result } = renderHook(() => usePreference('flag', true));
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem('ci:flag')).toBe('false');
  });

  it('syncs across tabs via storage event', () => {
    const { result } = renderHook(() => usePreference('cross-tab', 'initial'));

    act(() => {
      // Simulate storage event from another tab
      const event = new StorageEvent('storage', {
        key: 'ci:cross-tab',
        newValue: JSON.stringify('from-other-tab'),
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    });

    expect(result.current[0]).toBe('from-other-tab');
  });

  it('ignores storage events for other keys', () => {
    const { result } = renderHook(() => usePreference('my-key', 'mine'));

    act(() => {
      const event = new StorageEvent('storage', {
        key: 'ci:other-key',
        newValue: JSON.stringify('nope'),
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    });

    expect(result.current[0]).toBe('mine');
  });

  it('resets to defaultValue when storage event has newValue === null', () => {
    const { result } = renderHook(() => usePreference('nullable', 'default'));
    // First set a value
    act(() => result.current[1]('changed'));
    expect(result.current[0]).toBe('changed');

    // Simulate key removal from another tab (newValue === null)
    act(() => {
      const event = new StorageEvent('storage', {
        key: 'ci:nullable',
        newValue: null,
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    });

    expect(result.current[0]).toBe('default');
  });

  it('ignores storage event when validate rejects the new value', () => {
    const { result } = renderHook(() =>
      usePreference('validated-sync', 'good', {
        validate: (v) => v === 'good',
      }),
    );

    act(() => {
      const event = new StorageEvent('storage', {
        key: 'ci:validated-sync',
        newValue: JSON.stringify('bad'),
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    });

    // Should stay at original value because validate rejected
    expect(result.current[0]).toBe('good');
  });

  it('still updates state when localStorage.setItem throws', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => usePreference('full', 'init'));
    act(() => result.current[1]('new-val'));

    // State should still update even though setItem threw
    expect(result.current[0]).toBe('new-val');
    setItemSpy.mockRestore();
  });

  it('ignores storage event with bad JSON (catch branch)', () => {
    const { result } = renderHook(() => usePreference('bad-sync', 'safe'));

    act(() => {
      const event = new StorageEvent('storage', {
        key: 'ci:bad-sync',
        newValue: '%%%not-json%%%',
        storageArea: localStorage,
      });
      window.dispatchEvent(event);
    });

    // Should remain unchanged due to catch block
    expect(result.current[0]).toBe('safe');
  });

  it('cleans up storage event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => usePreference('cleanup', 'val'));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    removeSpy.mockRestore();
  });
});
