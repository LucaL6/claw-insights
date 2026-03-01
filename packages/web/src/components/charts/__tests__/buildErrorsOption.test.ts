import type { BarSeriesOption, ScatterSeriesOption, TooltipComponentOption } from 'echarts';
import { describe, expect, it } from 'vitest';

import { buildErrorsOption } from '../builders/buildErrorsOption';

type ChartSeries = (BarSeriesOption | ScatterSeriesOption)[];

const MOCK_DATA = [
  { bucket: 0, label: '0h', errors: 2, warnings: 1, restartEvent: false },
  { bucket: 1, label: '1h', errors: 0, warnings: 0, restartEvent: true },
  { bucket: 2, label: '2h', errors: 5, warnings: 3, restartEvent: false },
];

describe('buildErrorsOption', () => {
  it('returns 3 series: warnings, errors, restart scatter', () => {
    const opt = buildErrorsOption(MOCK_DATA, 'footer');
    const series = opt.series as ChartSeries;
    expect(series).toHaveLength(3);
    expect(series[0].name).toBe('Warnings');
    expect(series[1].name).toBe('Errors');
    expect(series[2].name).toBe('Restart');
  });

  it('maps restart events to scatter points', () => {
    const opt = buildErrorsOption(MOCK_DATA, 'footer');
    const scatter = (opt.series as ChartSeries)[2] as ScatterSeriesOption;
    expect(scatter.data).toEqual([[1, 0]]); // bucket 1 has restart
  });

  it('stacks warnings + errors', () => {
    const opt = buildErrorsOption(MOCK_DATA, 'footer');
    const series = opt.series as BarSeriesOption[];
    expect(series[0].stack).toBe('errors');
    expect(series[1].stack).toBe('errors');
  });

  it('uses correct color for warnings bar', () => {
    const opt = buildErrorsOption(MOCK_DATA, 'footer');
    const warnings = (opt.series as BarSeriesOption[])[0];
    expect((warnings.itemStyle as { color: string }).color).toBe('rgba(249,115,22,0.65)');
  });

  it('uses correct color for errors bar', () => {
    const opt = buildErrorsOption(MOCK_DATA, 'footer');
    const errors = (opt.series as BarSeriesOption[])[1];
    expect((errors.itemStyle as { color: string }).color).toBe('rgba(239,68,68,0.85)');
  });

  it('handles empty input', () => {
    const opt = buildErrorsOption([], 'footer');
    const series = opt.series as ChartSeries;
    expect(series[0].data).toEqual([]);
    expect(series[1].data).toEqual([]);
    expect(series[2].data).toEqual([]);
  });

  it('tooltip renders errors and warnings rows', () => {
    const opt = buildErrorsOption(MOCK_DATA, 'my footer');
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as (params: unknown[]) => string;
    const result = formatter([
      { seriesName: 'Warnings', value: 1, name: '0h', color: '#f97316' },
      { seriesName: 'Errors', value: 2, name: '0h', color: '#ef4444' },
      { seriesName: 'Restart', value: 0, name: '0h', color: '#fbbf24' },
    ]);
    expect(result).toContain('0h');
    expect(result).toContain('Warnings');
    expect(result).toContain('Errors');
    expect(result).not.toContain('Restart');
    expect(result).toContain('my footer');
  });

  it('tooltip shows restart indicator for restart bucket', () => {
    const opt = buildErrorsOption(MOCK_DATA, 'footer');
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as (params: unknown[]) => string;
    const result = formatter([
      { seriesName: 'Warnings', value: 0, name: '1h', color: '#f97316' },
      { seriesName: 'Errors', value: 0, name: '1h', color: '#ef4444' },
    ]);
    expect(result).toContain('Gateway restarted');
  });

  it('tooltip omits restart indicator for non-restart bucket', () => {
    const opt = buildErrorsOption(MOCK_DATA, 'footer');
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as (params: unknown[]) => string;
    const result = formatter([
      { seriesName: 'Warnings', value: 1, name: '0h', color: '#f97316' },
      { seriesName: 'Errors', value: 2, name: '0h', color: '#ef4444' },
    ]);
    expect(result).not.toContain('Gateway restarted');
  });

  it('zero errors and warnings still produces valid output', () => {
    const data = [{ bucket: 0, label: '0h', errors: 0, warnings: 0, restartEvent: false }];
    const opt = buildErrorsOption(data, 'footer');
    const series = opt.series as ChartSeries;
    expect(series[0].data).toEqual([0]);
    expect(series[1].data).toEqual([0]);
    expect(series[2].data).toEqual([]);
  });
});
