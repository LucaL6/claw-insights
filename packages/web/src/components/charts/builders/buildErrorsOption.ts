import type { EChartsOption } from 'echarts';

import { COLORS } from '../core/model-utils';
import { buildCategoryXAxis, CHART_GRID, COMPACT_Y_AXIS, tooltipHtml } from './shared';

interface ErrorBucket {
  bucket: number;
  label: string;
  errors: number;
  warnings: number;
  restartEvent: boolean;
}

export function buildErrorsOption(data: ErrorBucket[], footerText: string): EChartsOption {
  const labels = data.map((d) => d.label);
  const restartPoints = data.filter((d) => d.restartEvent).map((d) => [d.bucket, 0]);

  return {
    grid: CHART_GRID,
    xAxis: buildCategoryXAxis(labels),
    yAxis: { ...COMPACT_Y_AXIS, minInterval: 1 },
    tooltip: {
      appendToBody: true,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: number; name: string; color: string }>;
        const rows = items
          .filter((p) => p.seriesName !== 'Restart')
          .map((p) => ({ color: p.color, label: p.seriesName, value: String(p.value), marker: '●' }));
        const hasRestart = data.find((d) => d.label === items[0]?.name && d.restartEvent);
        const extra = hasRestart ? '<span style="color:#fbbf24">↻</span> Gateway restarted' : undefined;
        return tooltipHtml({ title: items[0]?.name ?? '', rows, footer: footerText, extra });
      },
    },
    series: [
      {
        name: 'Warnings',
        type: 'bar',
        stack: 'errors',
        data: data.map((d) => d.warnings),
        itemStyle: { color: 'rgba(249,115,22,0.4)', borderRadius: [0, 0, 0, 0] },
      },
      {
        name: 'Errors',
        type: 'bar',
        stack: 'errors',
        data: data.map((d) => d.errors),
        itemStyle: { color: 'rgba(239,68,68,0.6)', borderRadius: [2, 2, 0, 0] },
      },
      {
        name: 'Restart',
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 7,
        data: restartPoints,
        itemStyle: { color: COLORS.amber },
        z: 10,
      },
    ],
  };
}
