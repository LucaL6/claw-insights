import { describe, it, expect } from 'vitest';
import { buildSessionsOption } from '../builders/buildSessionsOption';
import type { LineSeriesOption, XAXisComponentOption } from 'echarts';

const MOCK_DATA = [
  { bucket: 0, label: '0h', sessions: 3 },
  { bucket: 1, label: '1h', sessions: 7 },
  { bucket: 2, label: '2h', sessions: 0 },
];

describe('buildSessionsOption', () => {
  it('returns valid ECharts option with series data', () => {
    const opt = buildSessionsOption(MOCK_DATA, 'footer text');
    expect(opt.series).toHaveLength(1);
    const series = (opt.series as LineSeriesOption[])[0];
    expect(series.type).toBe('line');
    expect(series.step).toBe('end');
    expect(series.data).toEqual([3, 7, 0]);
  });

  it('sets category xAxis from labels', () => {
    const opt = buildSessionsOption(MOCK_DATA, 'footer');
    expect((opt.xAxis as XAXisComponentOption).type).toBe('category');
    expect((opt.xAxis as XAXisComponentOption).data).toEqual(['0h', '1h', '2h']);
  });

  it('uses emerald color for line and area', () => {
    const opt = buildSessionsOption(MOCK_DATA, 'footer');
    const series = (opt.series as LineSeriesOption[])[0];
    expect(series.lineStyle!.color).toBe('#34d399');
    expect(series.areaStyle!.color).toBeDefined();
  });
});
