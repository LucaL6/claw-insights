import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { CHART_GRID, COLORS, COMPACT_Y_AXIS, bucketLabelInterval } from './echarts-theme';
import type { EChartsOption } from 'echarts';
import { TOOLTIPS } from './metricsTooltips';

interface BucketData { bucket: number; label: string; sessions: number }

export function SessionsChart({ data }: { data: BucketData[] }) {
  const option = useMemo((): EChartsOption => {
    const labels = data.map((d) => d.label);

    return {
      grid: CHART_GRID,
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { interval: bucketLabelInterval(data.length) },
      },
      yAxis: { ...COMPACT_Y_AXIS, minInterval: 1 },
      tooltip: { appendToBody: true, trigger: 'axis', formatter: (params: unknown) => {
        const p = (params as Array<{ name: string; value: number }>)[0];
        return `<b>${p.name}</b><br/>Sessions: <b style="color:${COLORS.emerald}">${p.value}</b>`
          + `<div style="color:#71717a;font-size:10px;margin-top:4px">${TOOLTIPS.chartFooter.sessions}</div>`;
      }},
      series: [{
        type: 'line',
        step: 'end',
        data: data.map(d => d.sessions),
        symbol: 'none',
        lineStyle: { color: COLORS.emerald, width: 1.5 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(52,211,153,0.25)' },
              { offset: 1, color: 'rgba(52,211,153,0.02)' },
            ],
          },
        },
      }],
    };
  }, [data]);

  return <BaseChart option={option} height={120} testId="sessions-chart" />;
}
