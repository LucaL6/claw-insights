import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { COLORS, hourLabels } from './echarts-theme';
import type { EChartsOption } from 'echarts';

interface HourlyData { hour: number; gatewayUp: boolean; restartEvent: boolean }

export function UptimeStrip({ data }: { data: HourlyData[] }) {
  const currentHour = new Date().getHours();

  const option = useMemo((): EChartsOption => ({
    grid: { top: 4, right: 12, bottom: 16, left: 36, containLabel: false },
    xAxis: {
      type: 'category',
      data: hourLabels(currentHour),
      axisLabel: { interval: 5, fontSize: 8 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: { show: false, max: 1 },
    tooltip: { trigger: 'axis', formatter: (params: unknown) => {
      const p = (params as Array<{ dataIndex: number; name: string }>)[0];
      const d = data[p.dataIndex];
      if (!d) return '';
      const status = d.gatewayUp ? '<b style="color:#34d399">UP</b>' : '<b style="color:#ef4444">DOWN</b>';
      let html = `<b>${p.name}</b> ${status}`;
      if (d.restartEvent) html += '<br/><span style="color:#fbbf24">↻ restart</span>';
      return html;
    }},
    series: [{
      type: 'bar',
      data: data.map(d => ({
        value: 1,
        itemStyle: {
          color: d.hour > currentHour ? 'rgba(63,63,70,0.1)' :
                 !d.gatewayUp ? COLORS.red :
                 d.restartEvent ? COLORS.amber :
                 'rgba(52,211,153,0.25)',
          borderColor: !d.gatewayUp ? COLORS.red : d.restartEvent ? COLORS.amber : 'transparent',
          borderWidth: d.gatewayUp && !d.restartEvent ? 0 : 1,
          borderRadius: 2,
        },
      })),
      barWidth: '90%',
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: 'rgba(52,211,153,0.4)', type: 'dashed', width: 1 },
        data: [{ xAxis: 'now' }],
        label: { show: false },
      },
    }],
  }), [data, currentHour]);

  return <BaseChart option={option} height={50} testId="uptime-chart" />;
}
