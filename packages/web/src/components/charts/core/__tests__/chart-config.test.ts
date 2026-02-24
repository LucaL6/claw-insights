import { describe, expect,it } from 'vitest';

import { bucketLabelInterval, CHART_GRID, COMPACT_Y_AXIS,futureZoneMarkArea, hourLabels } from '../chart-config';

describe('bucketLabelInterval', () => {
  it('returns 0 for ≤6 buckets', () => expect(bucketLabelInterval(6)).toBe(0));
  it('returns 1 for ≤12 buckets', () => expect(bucketLabelInterval(12)).toBe(1));
  it('returns 3 for ≤24 buckets', () => expect(bucketLabelInterval(24)).toBe(3));
  it('returns 5 for >24 buckets', () => expect(bucketLabelInterval(48)).toBe(5));
});

describe('hourLabels', () => {
  it('returns 24 labels', () => expect(hourLabels(10)).toHaveLength(24));
  it('marks current hour as "now"', () => {
    const labels = hourLabels(5);
    expect(labels[5]).toBe('now');
    expect(labels[0]).toBe('0h');
  });
});

describe('futureZoneMarkArea', () => {
  it('returns undefined at hour 23', () => expect(futureZoneMarkArea(23)).toBeUndefined());
  it('returns mark area for earlier hours', () => {
    const result = futureZoneMarkArea(10);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
  it('returns mark area at hour 0', () => {
    const result = futureZoneMarkArea(0);
    expect(result).toBeDefined();
  });
  it('returns mark area at hour 22', () => {
    const result = futureZoneMarkArea(22);
    expect(result).toBeDefined();
  });
});

describe('bucketLabelInterval edge cases', () => {
  it('returns 0 for 1 bucket', () => expect(bucketLabelInterval(1)).toBe(0));
  it('returns 1 for 7 buckets', () => expect(bucketLabelInterval(7)).toBe(1));
  it('returns 3 for 13 buckets', () => expect(bucketLabelInterval(13)).toBe(3));
});

describe('CHART_GRID', () => {
  it('has expected shape', () => {
    expect(CHART_GRID).toEqual(expect.objectContaining({ top: 8, right: 12 }));
  });
});

describe('COMPACT_Y_AXIS', () => {
  it('formats values >= 10000 without decimal', () => {
    expect(COMPACT_Y_AXIS.axisLabel.formatter(15000)).toBe('15k');
  });
  it('formats values >= 1000 with one decimal', () => {
    expect(COMPACT_Y_AXIS.axisLabel.formatter(1500)).toBe('1.5k');
  });
  it('formats values < 1000 as string', () => {
    expect(COMPACT_Y_AXIS.axisLabel.formatter(42)).toBe('42');
  });
});
