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

/** Compact Y-axis config for small charts (58px height) */
export const COMPACT_Y_AXIS = {
  type: 'value' as const,
  splitNumber: 2,
  axisLabel: {
    formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v),
  },
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
    itemStyle: { color: 'var(--chart-future-overlay)' },
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

/** Compute appropriate xAxis label interval based on total bucket count */
export function bucketLabelInterval(bucketCount: number): number {
  if (bucketCount <= 6) return 0;
  if (bucketCount <= 12) return 1;
  if (bucketCount <= 24) return 3;
  return 5;
}

/** Model family → color mapping for stacked charts */
export const MODEL_COLORS: Record<string, string> = {
  opus: '#38bdf8',     // sky-400
  sonnet: '#a78bfa',   // violet-400
  haiku: '#34d399',    // emerald-400
  gpt: '#fb923c',      // orange-400
};

export function getModelColor(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#71717a'; // zinc-500
}

export function shortModelName(model: string): string {
  const claude = model.match(/^(?:anthropic\/)?claude-(\w+)-(\d+)(?:-(\d+))?/);
  if (claude) {
    const family = claude[1].charAt(0).toUpperCase() + claude[1].slice(1);
    const version = claude[3] ? `${claude[2]}.${claude[3]}` : claude[2];
    return `${family} ${version}`;
  }
  const gpt = model.match(/^(?:openai\/)?gpt-([\d.]+)/);
  if (gpt) return `GPT ${gpt[1]}`;
  return model.length > 15 ? model.slice(0, 15) + '…' : model;
}

/** Build ECharts theme from current CSS variables (for dynamic theme switching) */
export function buildEChartsTheme() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();

  return {
    backgroundColor: 'transparent',
    textStyle: { color: v('--text-muted'), fontFamily: "'JetBrains Mono', monospace", fontSize: 9 },
    title: { textStyle: { color: v('--text-secondary') } },
    legend: { textStyle: { color: v('--text-muted') } },
    categoryAxis: {
      axisLine: { lineStyle: { color: v('--chart-axis') } },
      axisTick: { lineStyle: { color: v('--border') } },
      axisLabel: { color: v('--chart-axis-label') },
      splitLine: { lineStyle: { color: v('--chart-axis'), opacity: 0.3 } },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: v('--chart-axis') } },
      axisTick: { lineStyle: { color: v('--border') } },
      axisLabel: { color: v('--chart-axis-label') },
      splitLine: { lineStyle: { color: v('--chart-axis'), opacity: 0.3 } },
    },
    tooltip: {
      backgroundColor: v('--chart-tooltip-bg'),
      borderColor: v('--chart-tooltip-border'),
      textStyle: { color: v('--chart-tooltip-text'), fontSize: 11 },
    },
  };
}
