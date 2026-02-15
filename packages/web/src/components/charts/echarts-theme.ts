import type { EChartsOption } from 'echarts';

/** Shared dark theme matching V7 design palette */
export const DARK_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#71717a', fontFamily: "'JetBrains Mono', monospace", fontSize: 9 },
  title: { textStyle: { color: '#a1a1aa' } },
  legend: { textStyle: { color: '#71717a' } },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#27272a' } },
    axisTick: { lineStyle: { color: '#3f3f46' } },
    axisLabel: { color: '#52525b' },
    splitLine: { lineStyle: { color: '#27272a', opacity: 0.3 } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#27272a' } },
    axisTick: { lineStyle: { color: '#3f3f46' } },
    axisLabel: { color: '#52525b' },
    splitLine: { lineStyle: { color: '#27272a', opacity: 0.3 } },
  },
  tooltip: {
    backgroundColor: '#18181b',
    borderColor: '#3f3f46',
    textStyle: { color: '#d4d4d8', fontSize: 11 },
  },
};

/** Shared grid config (tight padding for dashboard charts) */
export const CHART_GRID: EChartsOption['grid'] = {
  top: 8, right: 12, bottom: 24, left: 36, containLabel: false,
};

/** Color palette for consistent chart colors */
export const COLORS = {
  emerald: '#34d399',
  emeraldDark: '#059669',
  sky: '#38bdf8',
  violet: '#a78bfa',
  amber: '#fbbf24',
  red: '#ef4444',
  orange: '#f97316',
  zinc: '#3f3f46',
} as const;

/** MarkArea for future hours (grey-out) */
export function futureZoneMarkArea(currentHour: number): EChartsOption['series'] {
  if (currentHour >= 23) return undefined;
  return [{
    silent: true,
    itemStyle: { color: 'rgba(9,9,11,0.4)' },
    data: [[
      { xAxis: `${currentHour + 1}h` },
      { xAxis: '23h' },
    ]],
  }];
}

/** Generate hour labels 0h-23h with "now" highlight */
export function hourLabels(currentHour: number): string[] {
  return Array.from({ length: 24 }, (_, i) => i === currentHour ? 'now' : `${i}h`);
}
