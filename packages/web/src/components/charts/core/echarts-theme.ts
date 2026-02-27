/**
 * Shared chart font sizes (px).
 * Mirrors CSS --font-size-caption (0.75rem = 12px) and --font-size-body-s (0.8125rem = 13px).
 * ECharts requires numeric px, so these are hardcoded but documented.
 * If --base-font-size changes, update these manually.
 */
export const CHART_FONT = {
  axis: 11,
  tooltip: 12,
} as const;

/** Shared dark theme matching V7 design palette */
export const DARK_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#71717a', fontFamily: "'JetBrains Mono', monospace", fontSize: CHART_FONT.axis },
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
    textStyle: { color: '#d4d4d8', fontSize: CHART_FONT.tooltip },
  },
};

/** Build ECharts theme from current CSS variables (for dynamic theme switching) */
export function buildEChartsTheme() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();

  return {
    backgroundColor: 'transparent',
    textStyle: { color: v('--text-muted'), fontFamily: "'JetBrains Mono', monospace", fontSize: CHART_FONT.axis },
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
      textStyle: { color: v('--chart-tooltip-text'), fontSize: CHART_FONT.tooltip },
    },
  };
}

// Re-export from split modules for backward compatibility
export { bucketLabelInterval, CHART_GRID, COMPACT_Y_AXIS, futureZoneMarkArea, hourLabels } from './chart-config';
export { COLORS, getModelColor, MODEL_COLORS, shortModelName } from './model-utils';
