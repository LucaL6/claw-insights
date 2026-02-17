import { describe, it, expect } from 'bun:test';
import { parseScreenshotParams } from '../route';

describe('parseScreenshotParams', () => {
  it('returns defaults for empty query', () => {
    const result = parseScreenshotParams({});
    expect(result).toEqual({
      section: 'dashboard',
      range: 'TWENTY_FOUR_HOUR',
      theme: 'dark',
      lang: 'en',
    });
  });

  it('parses valid section', () => {
    const result = parseScreenshotParams({ section: 'metrics' });
    expect(result.section).toBe('metrics');
  });

  it('parses valid range', () => {
    const result = parseScreenshotParams({ range: 'ONE_HOUR' });
    expect(result.range).toBe('ONE_HOUR');
  });

  it('parses valid theme', () => {
    const result = parseScreenshotParams({ theme: 'light' });
    expect(result.theme).toBe('light');
  });

  it('parses valid lang', () => {
    const result = parseScreenshotParams({ lang: 'zh' });
    expect(result.lang).toBe('zh');
  });

  it('throws on invalid section', () => {
    expect(() => parseScreenshotParams({ section: 'nope' })).toThrow('Invalid section');
  });

  it('throws on invalid range', () => {
    expect(() => parseScreenshotParams({ range: 'nope' })).toThrow('Invalid range');
  });

  it('throws on invalid theme', () => {
    expect(() => parseScreenshotParams({ theme: 'nope' })).toThrow('Invalid theme');
  });

  it('throws on invalid lang', () => {
    expect(() => parseScreenshotParams({ lang: 'nope' })).toThrow('Invalid lang');
  });
});
