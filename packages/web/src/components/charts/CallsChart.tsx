import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { CHART_GRID, COLORS, futureZoneMarkArea, hourLabels } from './echarts-theme';
import type { EChartsOption } from 'echarts';

interface HourlyData { hour: number; apiCalls: number; toolCalls: number }

export function CallsChart({ data }: { data: HourlyData[] }) {
  const currentHour = new Date().getHours();

  const option = useMemo((): EChartsOption => ({
    grid: CHART_GRID,
    xAxis: {
      type: 'category',
      data: hourLabels(currentHour),
      axisLabel: { interval: 5 },
    },
    yAxis: { type: 'value', minInterval: 1 },
    tooltip: { trigger: 'axis' },
    legend: { show: false },
    series: [
      {
        name: 'API',
        type: 'bar',
        data: data.map(d => d.apiCalls),
        itemStyle: { color: COLORS.violet, borderRadius: [1.5, 1.5, 0, 0] },
        markArea: futureZoneMarkArea(currentHour) as EChartsOption['series'],
      },
      {
        name: 'Tool',
        type: 'bar',
        data: data.map(d => d.toolCalls),
        itemStyle: { color: COLORS.amber, borderRadius: [1.5, 1.5, 0, 0] },
      },
    ],
  }), [data, currentHour]);

  return <BaseChart option={option} height={58} testId="calls-chart" />;
}
