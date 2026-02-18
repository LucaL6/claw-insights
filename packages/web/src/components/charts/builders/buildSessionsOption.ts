import type { EChartsOption } from 'echarts';
import { COLORS } from '../core/model-utils';
import { buildCategoryXAxis, CHART_GRID, COMPACT_Y_AXIS, tooltipHtml, areaGradient } from './shared';

interface SessionBucket {
  bucket: number;
  label: string;
  sessions: number;
}

export function buildSessionsOption(data: SessionBucket[], footerText: string): EChartsOption {
  const labels = data.map((d) => d.label);

  return {
    grid: CHART_GRID,
    xAxis: buildCategoryXAxis(labels),
    yAxis: { ...COMPACT_Y_AXIS, minInterval: 1 },
    tooltip: {
      appendToBody: true,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = (params as Array<{ name: string; value: number }>)[0];
        return tooltipHtml({
          title: p.name,
          rows: [{ color: COLORS.emerald, label: 'Sessions', value: String(p.value) }],
          footer: footerText,
        });
      },
    },
    series: [
      {
        type: 'line',
        step: 'end',
        data: data.map((d) => d.sessions),
        symbol: 'none',
        lineStyle: { color: COLORS.emerald, width: 1.5 },
        areaStyle: { color: areaGradient(COLORS.emerald, 0.25, 0.02) },
      },
    ],
  };
}
