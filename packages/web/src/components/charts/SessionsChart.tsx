import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { CHART_GRID, COLORS, COMPACT_Y_AXIS, futureZoneMarkArea, hourLabels } from './echarts-theme';
import type { EChartsOption } from 'echarts';

interface HourlyData { hour: number; sessions: number }

export function SessionsChart({ data }: { data: HourlyData[] }) {
  const currentHour = new Date().getHours();

  const option = useMemo((): EChartsOption => ({
    grid: CHART_GRID,
    xAxis: {
      type: 'category',
      data: hourLabels(currentHour),
      axisLabel: { interval: 5 },
    },
    yAxis: { ...COMPACT_Y_AXIS, minInterval: 1 },
    tooltip: { trigger: 'axis', formatter: (params: unknown) => {
      const p = (params as Array<{ name: string; value: number }>)[0];
      return `<b>${p.name}</b><br/>Sessions: <b style="color:${COLORS.emerald}">${p.value}</b>`;
    }},
    series: [{
      type: 'bar',
      data: data.map(d => d.sessions),
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: COLORS.emerald }, { offset: 1, color: COLORS.emeraldDark }],
        },
        borderRadius: [2, 2, 0, 0],
      },
      markArea: futureZoneMarkArea(currentHour) as EChartsOption['series'],
    }],
  }), [data, currentHour]);

  return <BaseChart option={option} height={58} testId="sessions-chart" />;
}
