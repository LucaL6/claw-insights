import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { CHART_GRID, COLORS, COMPACT_Y_AXIS, bucketLabelInterval } from './echarts-theme';
import type { EChartsOption } from 'echarts';
import { TOOLTIPS } from './metricsTooltips';

interface BucketData { bucket: number; label: string; errors: number; warnings: number; restartEvent: boolean }

export function ErrorsChart({ data }: { data: BucketData[] }) {
  const option = useMemo((): EChartsOption => {
    const labels = data.map((d) => d.label);
    const restartPoints = data
      .filter(d => d.restartEvent)
      .map(d => [d.bucket, 0]);

    return {
      grid: CHART_GRID,
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { interval: bucketLabelInterval(data.length) },
      },
      yAxis: { ...COMPACT_Y_AXIS, minInterval: 1 },
      tooltip: { trigger: 'axis', formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: number; name: string; color: string }>;
        let html = `<b>${items[0]?.name}</b>`;
        for (const p of items) {
          if (p.seriesName === 'Restart') continue;
          html += `<br/><span style="color:${p.color}">●</span> ${p.seriesName}: <b>${p.value}</b>`;
        }
        const hasRestart = data.find(d => d.label === items[0]?.name && d.restartEvent);
        if (hasRestart) html += '<br/><span style="color:#fbbf24">↻</span> Gateway restarted';
        html += `<div style="color:#71717a;font-size:10px;margin-top:4px">${TOOLTIPS.chartFooter.errors}</div>`;
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
  }, [data]);

  return <BaseChart option={option} height={80} testId="errors-chart" />;
}
