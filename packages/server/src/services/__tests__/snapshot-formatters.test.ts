import { describe, test, expect } from 'vitest';
import { formatTokens, friendlyModel, normalize, relativeTime, sample, uptimeStatus } from '../snapshot-formatters';

describe('formatTokens', () => {
  test('formats millions', () => {
    expect(formatTokens(1_500_000)).toBe('1.50M');
    expect(formatTokens(1_000_000)).toBe('1.00M');
  });
  test('formats thousands', () => {
    expect(formatTokens(1_500)).toBe('1.5k');
    expect(formatTokens(1_000)).toBe('1.0k');
  });
  test('formats small numbers as-is', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(0)).toBe('0');
  });
});

describe('friendlyModel', () => {
  test('strips provider prefix and formats', () => {
    expect(friendlyModel('anthropic/claude-opus-4-6')).toBe('Opus 4.6');
  });
  test('handles bare model name', () => {
    expect(friendlyModel('claude-sonnet-4')).toBe('Sonnet 4');
  });
  test('handles model without version', () => {
    expect(friendlyModel('anthropic/claude-haiku')).toBe('Haiku');
  });
  test('handles empty string', () => {
    expect(friendlyModel('')).toBe('');
  });
});

describe('normalize', () => {
  test('normalizes values to 0-100', () => {
    expect(normalize([0, 50, 100])).toEqual([0, 50, 100]);
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
    expect(normalize([10, 20, 40])).toEqual([25, 50, 100]);
  });
  test('handles empty array', () => {
    expect(normalize([])).toEqual([]);
  });
});

describe('relativeTime', () => {
  test('handles epoch ms number', () => {
    const fiveMinAgo = Date.now() - 5 * 60_000;
    expect(relativeTime(fiveMinAgo)).toBe('5m ago');
  });
  test('handles ISO string', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(fiveMinAgo)).toBe('5m ago');
  });
  test('handles 0 gracefully', () => {
    expect(relativeTime(0)).toBe('—');
  });
  test('returns — for NaN', () => {
    expect(relativeTime('not-a-date')).toBe('—');
  });
  test('just now for < 1 minute', () => {
    expect(relativeTime(Date.now() - 10_000)).toBe('just now');
  });
  test('hours', () => {
    expect(relativeTime(Date.now() - 3 * 3600_000)).toBe('3h ago');
  });
  test('days', () => {
    expect(relativeTime(Date.now() - 48 * 3600_000)).toBe('2d ago');
  });
});

describe('sample', () => {
  test('returns same array if length <= count', () => {
    expect(sample([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(sample([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });
  test('evenly samples down', () => {
    const result = sample([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 3);
    expect(result).toEqual([0, 50, 100]);
  });
  test('handles empty array', () => {
    expect(sample([], 5)).toEqual([]);
  });
});

describe('uptimeStatus', () => {
  test('up when >= 99', () => {
    expect(uptimeStatus(100)).toBe('up');
    expect(uptimeStatus(99)).toBe('up');
  });
  test('degraded when >= 90', () => {
    expect(uptimeStatus(98)).toBe('degraded');
    expect(uptimeStatus(90)).toBe('degraded');
  });
  test('down when < 90', () => {
    expect(uptimeStatus(89)).toBe('down');
    expect(uptimeStatus(0)).toBe('down');
  });
});
