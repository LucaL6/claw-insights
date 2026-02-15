import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { CHART_GRID, COLORS, futureZoneMarkArea, hourLabels } from './echarts-theme';
import type { EChartsOption } from 'echarts';

interface HourlyData { hour: number; errors: number; warnings: number; restartEvent: boolean }

export function ErrorsChart({ data }: { data: HourlyData[] }) {
  const currentHour = new Date().getHours();

  const option = useMemo((): EChartsOption => {
    const restartPoints = data
      .filter(d => d.restartEvent)
      .map(d => [d.hour, 0]);

    return {
      grid: CHART_GRID,
      xAxis: {
        type: 'category',
        data: hourLabels(currentHour),
        axisLabel: { interval: 2 },
      },
      yAxis: { type: 'value', minInterval: 1 },
      tooltip: { trigger: 'axis', formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: number; name: string; color: string }>;
        let html = `<b>${items[0]?.name}</b>`;
        for (const p of items) {
          if (p.seriesName === 'Restart') continue;
          html += `<br/><span style="color:${p.color}">●</span> ${p.seriesName}: <b>${p.value}</b>`;
        }
        const hasRestart = data.find(d => hourLabels(currentHour)[d.hour] === items[0]?.name && d.restartEvent);
        if (hasRestart) html += '<br/><span style="color:#fbbf24">↻</span> Gateway restarted';
        return html;
      }},
      series: [
        {
          name: 'Warnings',
          type: 'bar',
          stack: 'errors',
          data: data.map(d => d.warnings),
          itemStyle: { color: 'rgba(249,115,22,0.4)', borderRadius: [0, 0, 0, 0] },
        },
        {
          name: 'Errors',
          type: 'bar',
          stack: 'errors',
          data: data.map(d => d.errors),
          itemStyle: { color: 'rgba(239,68,68,0.6)', borderRadius: [2, 2, 0, 0] },
          markArea: futureZoneMarkArea(currentHour) as EChartsOption['series'],
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
  }, [data, currentHour]);

  return <BaseChart option={option} height={50} testId="errors-chart" />;
}
