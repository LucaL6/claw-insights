import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../context';

if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

function TestConsumer() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button data-testid="toggle" onClick={toggleTheme} />
      <button data-testid="set-light" onClick={() => setTheme('light')} />
      <button data-testid="set-dark" onClick={() => setTheme('dark')} />
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });
  afterEach(() => {
    cleanup();
    window.location.hash = '';
    localStorage.clear();
  });

  it('defaults to dark', () => {
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('reads theme from URL hash param', () => {
    window.location.hash = '#?theme=light';
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('reads theme from localStorage', () => {
    localStorage.setItem('theme', 'light');
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('URL param overrides localStorage', () => {
    localStorage.setItem('theme', 'light');
    window.location.hash = '#?theme=dark';
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('toggleTheme switches dark→light', () => {
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    act(() => screen.getByTestId('toggle').click());
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('setTheme updates localStorage and document attribute', () => {
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    act(() => screen.getByTestId('set-light').click());
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('useTheme throws outside provider', () => {
    expect(() => render(<TestConsumer />)).toThrow('useTheme must be inside ThemeProvider');
  });
});
