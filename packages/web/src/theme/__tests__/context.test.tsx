import { act,renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach,describe, expect, it } from 'vitest';

import { ThemeProvider, useTheme } from '../context';

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
  <ThemeProvider>{children}</ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeProvider with usePreference', () => {
  it('defaults to dark', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
  });

  it('persists theme to ci:theme key', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme('light'));
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem('ci:theme')).toBe(JSON.stringify('light'));
  });

  it('reads from ci:theme on mount', () => {
    localStorage.setItem('ci:theme', JSON.stringify('light'));
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
  });

  it('migrates old "theme" key to "ci:theme"', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBeNull();
    expect(localStorage.getItem('ci:theme')).toBe(JSON.stringify('light'));
  });

  it('toggles between dark and light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('ignores invalid old key value during migration', () => {
    localStorage.setItem('theme', 'invalid-value');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark'); // default
    // Old key should be preserved if migration fails validation
    expect(localStorage.getItem('theme')).toBe('invalid-value');
  });

  it('URL hash theme param overrides localStorage', () => {
    localStorage.setItem('ci:theme', JSON.stringify('dark'));
    // Simulate URL hash param
    const original = window.location.hash;
    window.location.hash = '#/?theme=light';
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
    // localStorage should still have dark (URL doesn't persist)
    expect(localStorage.getItem('ci:theme')).toBe(JSON.stringify('dark'));
    window.location.hash = original;
  });

  it('migrates old JSON-formatted theme key', () => {
    // Some environments might have stored as JSON string
    localStorage.setItem('theme', '"dark"');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBeNull();
    expect(localStorage.getItem('ci:theme')).toBe(JSON.stringify('dark'));
  });
});
