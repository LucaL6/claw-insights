import type { EChartsOption } from 'echarts';

/** Shared grid config (tight padding for dashboard charts) */
export const CHART_GRID: EChartsOption['grid'] = {
  top: 8,
  right: 12,
  bottom: 24,
  left: 36,
  containLabel: false,
};

/** Compact Y-axis config for small charts (58px height) */
export const COMPACT_Y_AXIS = {
  type: 'value' as const,
  splitNumber: 2,
  axisLabel: {
    formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v)),
  },
};

/** Compute appropriate xAxis label interval based on total bucket count */
export function bucketLabelInterval(bucketCount: number): number {
  if (bucketCount <= 6) {return 0;}
  if (bucketCount <= 12) {return 1;}
  if (bucketCount <= 24) {return 3;}
  return 5;
}

/** MarkArea for future hours (grey-out) */
export function futureZoneMarkArea(currentHour: number): EChartsOption['series'] {
  if (currentHour >= 23) {return undefined;}
  return [
    {
      silent: true,
      itemStyle: { color: 'var(--chart-future-overlay)' },
      data: [[{ xAxis: `${currentHour + 1}h` }, { xAxis: '23h' }]],
    },
  ];
}

/** Generate hour labels 0h-23h with "now" highlight */
export function hourLabels(currentHour: number): string[] {
  return Array.from({ length: 24 }, (_, i) => (i === currentHour ? 'now' : `${i}h`));
}
