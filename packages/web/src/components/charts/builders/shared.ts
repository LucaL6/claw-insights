import { CHART_GRID, COMPACT_Y_AXIS, bucketLabelInterval } from '../core/chart-config';

export { CHART_GRID, COMPACT_Y_AXIS };

/** Standard category X-axis used by all charts */
export function buildCategoryXAxis(labels: string[], overrides?: Record<string, unknown>) {
  return {
    type: 'category' as const,
    data: labels,
    axisLabel: { interval: bucketLabelInterval(labels.length) },
    ...overrides,
  };
}

/** Tooltip row descriptor */
export interface TooltipRow {
  color: string;
  label: string;
  value: string;
  /** Use '■' (square) or '●' (circle) — default '■' */
  marker?: string;
}

/** Build standardized tooltip HTML */
export function tooltipHtml(opts: { title: string; rows: TooltipRow[]; footer?: string; extra?: string }): string {
  let html = `<b>${opts.title}</b>`;
  for (const r of opts.rows) {
    const marker = r.marker ?? '■';
    html += `<br/><span style="color:${r.color}">${marker}</span> ${r.label}: <b>${r.value}</b>`;
  }
  if (opts.extra) html += `<br/>${opts.extra}`;
  if (opts.footer) html += `<div style="color:#71717a;font-size:10px;margin-top:4px">${opts.footer}</div>`;
  return html;
}

/** Linear vertical gradient for area charts */
export function areaGradient(color: string, topOpacity: number, bottomOpacity: number) {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `rgba(${r},${g},${b},${topOpacity})` },
      { offset: 1, color: `rgba(${r},${g},${b},${bottomOpacity})` },
    ],
  };
}
