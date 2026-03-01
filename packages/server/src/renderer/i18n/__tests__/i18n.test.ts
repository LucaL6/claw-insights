import { describe, expect, it } from 'vitest';

import { formatRange, resolveLocale, t } from '../index.js';

describe('resolveLocale', () => {
  it('returns en for "en"', () => expect(resolveLocale('en')).toBe('en'));
  it('returns zh for "zh"', () => expect(resolveLocale('zh')).toBe('zh'));
  it('resolves zh-CN to zh', () => expect(resolveLocale('zh-CN')).toBe('zh'));
  it('resolves zh-cn to zh', () => expect(resolveLocale('zh-cn')).toBe('zh'));
  it('resolves zh-TW to zh', () => expect(resolveLocale('zh-TW')).toBe('zh'));
  it('resolves zh-HK to zh', () => expect(resolveLocale('zh-HK')).toBe('zh'));
  it('falls back to en for unknown locale "fr"', () => expect(resolveLocale('fr')).toBe('en'));
  it('falls back to en for empty string', () => expect(resolveLocale('')).toBe('en'));
});

describe('t', () => {
  it('returns English text', () => {
    expect(t('status.online', 'en')).toBe('Online');
  });

  it('returns Chinese text', () => {
    expect(t('status.online', 'zh')).toBe('在线');
  });

  it('falls back to English for unknown locale', () => {
    expect(t('status.online', 'fr')).toBe('Online');
  });

  it('interpolates variables', () => {
    expect(t('header.subtitle', 'en', { range: '6 Hours' })).toBe('Last 6 Hours');
  });

  it('interpolates variables in Chinese', () => {
    expect(t('header.subtitle', 'zh', { range: '6 小时' })).toBe('最近 6 小时');
  });

  it('returns key for missing message', () => {
    expect(t('nonexistent.key', 'en')).toBe('nonexistent.key');
  });
});

describe('formatRange', () => {
  it.each([
    ['30m', 'en', '30 Minutes'],
    ['1h', 'en', '1 Hour'],
    ['6h', 'en', '6 Hours'],
    ['12h', 'en', '12 Hours'],
    ['24h', 'en', '24 Hours'],
    ['30m', 'zh', '30 分钟'],
    ['1h', 'zh', '1 小时'],
    ['6h', 'zh', '6 小时'],
    ['12h', 'zh', '12 小时'],
    ['24h', 'zh', '24 小时'],
  ])('formatRange(%s, %s) → %s', (range, locale, expected) => {
    expect(formatRange(range, locale)).toBe(expected);
  });

  it('returns raw range for unknown range key', () => {
    expect(formatRange('99h', 'en')).toBe('99h');
  });
});
