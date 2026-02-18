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

// Re-export from split modules for backward compatibility
export { CHART_GRID, COMPACT_Y_AXIS, bucketLabelInterval, futureZoneMarkArea, hourLabels } from './chart-config';
export { COLORS, MODEL_COLORS, getModelColor, shortModelName } from './model-utils';
