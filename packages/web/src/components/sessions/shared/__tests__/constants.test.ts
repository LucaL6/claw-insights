import { describe, expect, it } from 'vitest';

import { getProgressColor } from '../constants';

describe('getProgressColor', () => {
  it('returns red for percent >= 80', () => {
    expect(getProgressColor(80)).toBe('var(--red)');
    expect(getProgressColor(100)).toBe('var(--red)');
  });

  it('returns amber for percent >= 50 and < 80', () => {
    expect(getProgressColor(50)).toBe('var(--amber)');
    expect(getProgressColor(79)).toBe('var(--amber)');
  });

  it('returns emerald for percent < 50', () => {
    expect(getProgressColor(0)).toBe('var(--emerald)');
    expect(getProgressColor(49)).toBe('var(--emerald)');
  });
});
