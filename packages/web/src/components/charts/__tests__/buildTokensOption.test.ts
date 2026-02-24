import { describe, it, expect } from 'vitest';
import { buildTokensOption } from '../builders/buildTokensOption';
import type { BarSeriesOption, YAXisComponentOption, TooltipComponentOption } from 'echarts';

type TooltipFormatter = Exclude<
  Exclude<TooltipComponentOption['formatter'], string | undefined>,
  // narrow to the function form
  string
>;

const MOCK_DATA_SIMPLE = [
  { bucket: 0, label: '0h', tokensK: 5.2 },
  { bucket: 1, label: '1h', tokensK: 12.1 },
];

const MOCK_DATA_MODELS = [
  {
    bucket: 0,
    label: '0h',
    tokensK: 15,
    tokensByModel: [
      { model: 'anthropic/claude-sonnet-4', tokensK: 10 },
      { model: 'anthropic/claude-haiku-4', tokensK: 5 },
    ],
  },
  {
    bucket: 1,
    label: '1h',
    tokensK: 20,
    tokensByModel: [
      { model: 'anthropic/claude-sonnet-4', tokensK: 8 },
      { model: 'anthropic/claude-haiku-4', tokensK: 12 },
    ],
  },
];

describe('buildTokensOption', () => {
  it('returns single bar series when no model data', () => {
    const opt = buildTokensOption(MOCK_DATA_SIMPLE, null, 'footer');
    const series = opt.series as BarSeriesOption[];
    expect(series).toHaveLength(1);
    expect(series[0].type).toBe('bar');
    expect(series[0].data).toEqual([5.2, 12.1]);
  });

  it('returns stacked series per model when model data present', () => {
    const opt = buildTokensOption(MOCK_DATA_MODELS, null, 'footer');
    const series = opt.series as BarSeriesOption[];
    expect(series.length).toBe(2);
    expect(series.every((s: BarSeriesOption) => s.stack === 'tokens')).toBe(true);
  });

  it('filters to selected model', () => {
    const opt = buildTokensOption(MOCK_DATA_MODELS, 'anthropic/claude-sonnet-4', 'footer');
    const series = opt.series as BarSeriesOption[];
    expect(series).toHaveLength(1);
    expect(series[0].name).toContain('Sonnet');
  });

  it('handles empty buckets', () => {
    const opt = buildTokensOption([], null, 'footer');
    const series = opt.series as BarSeriesOption[];
    expect(series).toHaveLength(1);
    expect(series[0].data).toEqual([]);
  });

  it('yAxis formatter handles 0, small, and large values', () => {
    const opt = buildTokensOption(MOCK_DATA_SIMPLE, null, 'footer');
    const formatter = (opt.yAxis as YAXisComponentOption & { axisLabel: { formatter: (v: number) => string } }).axisLabel.formatter;
    expect(formatter(0)).toBe('0');
    expect(formatter(500)).toBe('500k');
    expect(formatter(1000)).toBe('1.0M');
    expect(formatter(2500)).toBe('2.5M');
  });

  it('no-model tooltip formatter renders correctly', () => {
    const opt = buildTokensOption(MOCK_DATA_SIMPLE, null, 'my footer');
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as TooltipFormatter;
    const result = (formatter as (params: unknown[]) => string)([{ name: '0h', value: 5.2 }]);
    expect(result).toContain('0h');
    expect(result).toContain('5.2k');
    expect(result).toContain('my footer');
  });

  it('no-model tooltip returns empty for missing param', () => {
    const opt = buildTokensOption(MOCK_DATA_SIMPLE, null, 'footer');
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as TooltipFormatter;
    expect((formatter as (params: unknown[]) => string)([])).toBe('');
  });

  it('stacked model tooltip formatter renders rows and total', () => {
    const opt = buildTokensOption(MOCK_DATA_MODELS, null, 'ft');
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as TooltipFormatter;
    const result = (formatter as (params: unknown[]) => string)([
      { seriesName: 'Haiku', value: 5, color: '#aaa', name: '0h' },
      { seriesName: 'Sonnet', value: 10, color: '#bbb', name: '0h' },
    ]);
    expect(result).toContain('0h');
    expect(result).toContain('Haiku');
    expect(result).toContain('Total');
    expect(result).toContain('15.0k');
  });

  it('stacked model tooltip returns empty for empty items', () => {
    const opt = buildTokensOption(MOCK_DATA_MODELS, null, 'ft');
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as TooltipFormatter;
    expect((formatter as (params: unknown[]) => string)([])).toBe('');
  });

  it('stacked model tooltip filters zero-value rows', () => {
    const opt = buildTokensOption(MOCK_DATA_MODELS, null, 'ft');
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as TooltipFormatter;
    const result = (formatter as (params: unknown[]) => string)([
      { seriesName: 'Haiku', value: 0, color: '#aaa', name: '0h' },
      { seriesName: 'Sonnet', value: 10, color: '#bbb', name: '0h' },
    ]);
    expect(result).not.toContain('Haiku');
    expect(result).toContain('Sonnet');
  });

  it('single visible model tooltip omits Total', () => {
    const opt = buildTokensOption(MOCK_DATA_MODELS, 'anthropic/claude-sonnet-4', 'ft');
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as TooltipFormatter;
    const result = (formatter as (params: unknown[]) => string)([
      { seriesName: 'Sonnet', value: 10, color: '#bbb', name: '0h' },
    ]);
    expect(result).not.toContain('Total');
  });

  it('handles model with missing tokensByModel entries (returns 0)', () => {
    const data = [
      {
        bucket: 0, label: '0h', tokensK: 10,
        tokensByModel: [{ model: 'anthropic/claude-sonnet-4', tokensK: 10 }],
      },
      {
        bucket: 1, label: '1h', tokensK: 5,
        tokensByModel: [{ model: 'anthropic/claude-haiku-4', tokensK: 5 }],
      },
    ];
    const opt = buildTokensOption(data, null, 'ft');
    const series = opt.series as BarSeriesOption[];
    // Each model should have a 0 for the bucket it's missing from
    const sonnetSeries = series.find((s: BarSeriesOption) => (s.name as string).includes('Sonnet'));
    expect(sonnetSeries!.data).toEqual([10, 0]);
  });
});
