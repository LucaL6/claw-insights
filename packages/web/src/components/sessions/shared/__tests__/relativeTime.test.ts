import { describe, it, expect } from 'vitest';
import { relativeTime } from '../relativeTime';

const t = (key: string, params?: Record<string, string | number>) => {
  const map: Record<string, string> = {
    'time.justNow': 'just now',
    'time.mAgo': '{n}m ago',
    'time.hAgo': '{n}h ago',
    'time.dAgo': '{n}d ago',
  };
  let text = map[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
};

describe('relativeTime', () => {
  it('returns "just now" for <60s', () => {
    expect(relativeTime(Date.now() - 30_000, t)).toBe('just now');
  });

  it('returns "just now" for 0 diff', () => {
    expect(relativeTime(Date.now(), t)).toBe('just now');
  });

  it('returns minutes ago', () => {
    expect(relativeTime(Date.now() - 5 * 60_000, t)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    expect(relativeTime(Date.now() - 3 * 3600_000, t)).toBe('3h ago');
  });

  it('returns days ago', () => {
    expect(relativeTime(Date.now() - 2 * 86400_000, t)).toBe('2d ago');
  });

  it('returns 1d ago for yesterday', () => {
    expect(relativeTime(Date.now() - 86400_000, t)).toBe('1d ago');
  });

  it('handles 59 minutes', () => {
    expect(relativeTime(Date.now() - 59 * 60_000, t)).toBe('59m ago');
  });

  it('handles exactly 60 minutes as 1h', () => {
    expect(relativeTime(Date.now() - 60 * 60_000, t)).toBe('1h ago');
  });
});
