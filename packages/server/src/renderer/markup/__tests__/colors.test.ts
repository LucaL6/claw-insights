import { describe, expect, test } from 'vitest';

import { DARK, getColors, LIGHT } from '../colors';

const NEW_FIELDS = [
  'glassBg',
  'glassBorder',
  'glassDivider',
  'onlineDot',
  'onlineGlow',
  'accentIndigo',
  'modelGradients',
  'trendBadge',
  'rangePill',
  'miniBarGradient',
] as const;

describe('ColorScheme', () => {
  test.each(NEW_FIELDS)('DARK has %s', (field) => {
    expect(DARK[field]).toBeDefined();
  });

  test.each(NEW_FIELDS)('LIGHT has %s', (field) => {
    expect(LIGHT[field]).toBeDefined();
  });

  test('modelGradients has 5 entries with pairs', () => {
    expect(DARK.modelGradients).toHaveLength(5);
    for (const pair of DARK.modelGradients) {
      expect(pair).toHaveLength(2);
    }
  });

  test('trendBadge has bg, color, border', () => {
    expect(DARK.trendBadge).toHaveProperty('bg');
    expect(DARK.trendBadge).toHaveProperty('color');
    expect(DARK.trendBadge).toHaveProperty('border');
  });

  test('rangePill has bg, color, border', () => {
    expect(DARK.rangePill).toHaveProperty('bg');
    expect(DARK.rangePill).toHaveProperty('color');
    expect(DARK.rangePill).toHaveProperty('border');
  });

  test('miniBarGradient is a pair', () => {
    expect(DARK.miniBarGradient).toHaveLength(2);
    expect(LIGHT.miniBarGradient).toHaveLength(2);
  });

  test('getColors returns correct scheme', () => {
    expect(getColors('dark')).toBe(DARK);
    expect(getColors('light')).toBe(LIGHT);
  });
});
