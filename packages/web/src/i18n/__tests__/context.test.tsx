import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { I18nProvider, useI18n } from '../context';

// Ensure localStorage
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
  const { lang, t, toggleLang, setLang } = useI18n();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="translated">{t('time.justNow')}</span>
      <span data-testid="interpolated">{t('time.mAgo', { n: 5 })}</span>
      <span data-testid="missing">{t('nonexistent.key')}</span>
      <button data-testid="toggle" onClick={toggleLang} />
      <button data-testid="set-zh" onClick={() => setLang('zh')} />
      <button data-testid="set-en" onClick={() => setLang('en')} />
    </div>
  );
}

describe('I18nProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  afterEach(() => {
    cleanup();
    window.location.hash = '';
    localStorage.clear();
  });

  it('defaults to en', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>);
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('translated').textContent).toBe('just now');
  });

  it('reads lang from URL hash param', () => {
    window.location.hash = '#dashboard?lang=zh';
    render(<I18nProvider><TestConsumer /></I18nProvider>);
    expect(screen.getByTestId('lang').textContent).toBe('zh');
  });

  it('reads lang from localStorage', () => {
    localStorage.setItem('lang', 'zh');
    render(<I18nProvider><TestConsumer /></I18nProvider>);
    expect(screen.getByTestId('lang').textContent).toBe('zh');
  });

  it('URL param overrides localStorage', () => {
    localStorage.setItem('lang', 'zh');
    window.location.hash = '#?lang=en';
    render(<I18nProvider><TestConsumer /></I18nProvider>);
    expect(screen.getByTestId('lang').textContent).toBe('en');
  });

  it('falls back to navigator.language for zh', () => {
    const orig = navigator.language;
    Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true });
    render(<I18nProvider><TestConsumer /></I18nProvider>);
    expect(screen.getByTestId('lang').textContent).toBe('zh');
    Object.defineProperty(navigator, 'language', { value: orig, configurable: true });
  });

  it('interpolates params', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>);
    expect(screen.getByTestId('interpolated').textContent).toBe('5m ago');
  });

  it('returns key for missing translation', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>);
    expect(screen.getByTestId('missing').textContent).toBe('nonexistent.key');
  });

  it('toggleLang switches en→zh', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>);
    act(() => screen.getByTestId('toggle').click());
    expect(screen.getByTestId('lang').textContent).toBe('zh');
  });

  it('setLang updates localStorage', () => {
    render(<I18nProvider><TestConsumer /></I18nProvider>);
    act(() => screen.getByTestId('set-zh').click());
    expect(localStorage.getItem('lang')).toBe('zh');
    expect(screen.getByTestId('lang').textContent).toBe('zh');
  });

  it('useI18n throws outside provider', () => {
    expect(() => render(<TestConsumer />)).toThrow('useI18n must be inside I18nProvider');
  });
});
