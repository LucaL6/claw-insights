import { describe, expect, it } from 'vitest';

import { mergeMetricsArgs,mergeTimeRange } from '../merge-filter.js';

describe('mergeTimeRange', () => {
  it('returns field args when provided', () => {
    expect(mergeTimeRange({ from: 100, to: 200 }, { timeRange: { from: 0, to: 50 } })).toEqual({
      from: 100,
      to: 200,
    });
  });

  it('falls back to defaults when no field args', () => {
    expect(mergeTimeRange({}, { timeRange: { from: 0, to: 50 } })).toEqual({ from: 0, to: 50 });
  });

  it('returns empty when neither provided', () => {
    expect(mergeTimeRange({}, undefined)).toEqual({});
  });

  it('partial field args override partial defaults', () => {
    expect(mergeTimeRange({ from: 100 }, { timeRange: { from: 0, to: 50 } })).toEqual({ from: 100, to: 50 });
  });

  it('strips null values from merged output', () => {
    expect(mergeTimeRange({ from: null }, { timeRange: { from: 10, to: null } })).toEqual({ from: 10 });
  });
});

describe('mergeMetricsArgs', () => {
  it('returns field args when provided', () => {
    expect(mergeMetricsArgs({ range: 'ONE_HOUR', date: '2026-03-05' }, undefined)).toEqual({
      range: 'ONE_HOUR',
      date: '2026-03-05',
    });
  });

  it('maps preset to range from defaults', () => {
    expect(mergeMetricsArgs({}, { timeRange: { preset: 'SIX_HOUR' } })).toEqual({ range: 'SIX_HOUR' });
  });

  it('does NOT map from/to to date (semantic mismatch)', () => {
    expect(mergeMetricsArgs({}, { timeRange: { from: 100, to: 200 } })).toEqual({});
  });

  it('field range overrides preset default', () => {
    expect(mergeMetricsArgs({ range: 'ONE_HOUR' }, { timeRange: { preset: 'SIX_HOUR' } })).toEqual({
      range: 'ONE_HOUR',
    });
  });

  it('ignores null metrics args and keeps mapped defaults', () => {
    expect(mergeMetricsArgs({ range: null, date: null }, { timeRange: { preset: 'TWELVE_HOUR' } })).toEqual({
      range: 'TWELVE_HOUR',
    });
  });
});
