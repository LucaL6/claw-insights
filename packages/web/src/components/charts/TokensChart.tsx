import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { CHART_GRID, COLORS, COMPACT_Y_AXIS, futureZoneMarkArea, hourLabels } from './echarts-theme';
import type { EChartsOption } from 'echarts';

interface HourlyData { hour: number; tokensK: number }

export function TokensChart({ data }: { data: HourlyData[] }) {
  const currentHour = new Date().getHours();

  const option = useMemo((): EChartsOption => {
    // tokensK is cumulative (MAX total_tokens_k per hour) — carry forward through current hour
    const cumData: number[] = [];
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i].tokensK > 0) last = data[i].tokensK;
      cumData.push(i <= currentHour ? last : 0);
    }

    return {
      grid: CHART_GRID,
      xAxis: {
        type: 'category',
        data: hourLabels(currentHour),
        axisLabel: { interval: 5 },
      },
      yAxis: COMPACT_Y_AXIS,
      tooltip: { trigger: 'axis', formatter: (params: unknown) => {
        const p = (params as Array<{ name: string; value: number }>)[0];
        return `<b>${p.name}</b><br/><b style="color:${COLORS.sky}">${p.value.toFixed(1)}k</b> total tokens`;
      }},
      series: [{
        type: 'line',
        data: cumData,
        smooth: true,
        symbol: 'circle',
        symbolSize: (value: number, params: { dataIndex: number }) =>
          params.dataIndex === currentHour ? 6 : 0,
        lineStyle: { color: COLORS.sky, width: 1.5 },
        itemStyle: { color: COLORS.sky },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(56,189,248,0.2)' },
              { offset: 1, color: 'rgba(56,189,248,0.02)' },
            ],
          },
        },
        markArea: futureZoneMarkArea(currentHour) as EChartsOption['series'],
      }],
    };
  }, [data, currentHour]);

  return <BaseChart option={option} height={58} testId="tokens-chart" />;
}
