import { describe, it, expect } from 'vitest';
import { buildUptimeOption } from '../builders/buildUptimeOption';
import type { BarSeriesOption, YAXisComponentOption, TooltipComponentOption } from 'echarts';

interface UptimeBarItem {
  value: number;
  itemStyle: { color: string };
}

const MOCK_DATA = [
  { bucket: 0, label: '0h', gatewayUp: true, restartEvent: false },
  { bucket: 1, label: '1h', gatewayUp: false, restartEvent: false },
  { bucket: 2, label: '2h', gatewayUp: true, restartEvent: true },
];

describe('buildUptimeOption', () => {
  it('returns single bar series with per-item colors', () => {
    const opt = buildUptimeOption(MOCK_DATA);
    const series = (opt.series as BarSeriesOption[])[0];
    expect(series.type).toBe('bar');
    expect(series.data).toHaveLength(3);
  });

  it('colors down buckets red', () => {
    const opt = buildUptimeOption(MOCK_DATA);
    const item = (opt.series as BarSeriesOption[])[0].data![1] as UptimeBarItem;
    expect(item.itemStyle.color).toBe('#ef4444');
  });

  it('colors restart buckets amber', () => {
    const opt = buildUptimeOption(MOCK_DATA);
    const item = (opt.series as BarSeriesOption[])[0].data![2] as UptimeBarItem;
    expect(item.itemStyle.color).toBe('#fbbf24');
  });

  it('colors normal buckets with low-opacity emerald', () => {
    const opt = buildUptimeOption(MOCK_DATA);
    const item = (opt.series as BarSeriesOption[])[0].data![0] as UptimeBarItem;
    expect(item.itemStyle.color).toBe('rgba(52,211,153,0.25)');
  });

  it('hides yAxis', () => {
    const opt = buildUptimeOption(MOCK_DATA);
    expect((opt.yAxis as YAXisComponentOption).show).toBe(false);
  });

  it('handles empty data array', () => {
    const opt = buildUptimeOption([]);
    const series = (opt.series as BarSeriesOption[])[0];
    expect(series.data).toHaveLength(0);
  });

  it('tooltip shows UP for healthy bucket', () => {
    const opt = buildUptimeOption(MOCK_DATA);
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as (params: unknown[]) => string;
    const result = formatter([{ dataIndex: 0, name: '0h' }]);
    expect(result).toContain('UP');
    expect(result).not.toContain('restart');
  });

  it('tooltip shows DOWN for unhealthy bucket', () => {
    const opt = buildUptimeOption(MOCK_DATA);
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as (params: unknown[]) => string;
    const result = formatter([{ dataIndex: 1, name: '1h' }]);
    expect(result).toContain('DOWN');
  });

  it('tooltip shows restart indicator', () => {
    const opt = buildUptimeOption(MOCK_DATA);
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as (params: unknown[]) => string;
    const result = formatter([{ dataIndex: 2, name: '2h' }]);
    expect(result).toContain('UP');
    expect(result).toContain('restart');
  });

  it('tooltip returns empty for out-of-bounds index', () => {
    const opt = buildUptimeOption(MOCK_DATA);
    const formatter = (opt.tooltip as TooltipComponentOption).formatter as (params: unknown[]) => string;
    expect(formatter([{ dataIndex: 99, name: 'bad' }])).toBe('');
  });

  it('all-down scenario colors every bucket red', () => {
    const allDown = [
      { bucket: 0, label: '0h', gatewayUp: false, restartEvent: false },
      { bucket: 1, label: '1h', gatewayUp: false, restartEvent: false },
    ];
    const opt = buildUptimeOption(allDown);
    const data = (opt.series as BarSeriesOption[])[0].data as UptimeBarItem[];
    expect(data.every((d: UptimeBarItem) => d.itemStyle.color === '#ef4444')).toBe(true);
  });
});
