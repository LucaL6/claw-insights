import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { COLORS, bucketLabelInterval } from './echarts-theme';
import type { EChartsOption } from 'echarts';

interface BucketData { bucket: number; label: string; gatewayUp: boolean; restartEvent: boolean }

export function UptimeStrip({ data }: { data: BucketData[] }) {
  const option = useMemo((): EChartsOption => {
    const labels = data.map((d) => d.label);
    // Last bucket is "now"
    const lastLabel = labels[labels.length - 1] ?? '';

    return {
      grid: { top: 4, right: 12, bottom: 16, left: 36, containLabel: false },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { interval: bucketLabelInterval(data.length), fontSize: 8 },
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
        data: data.map((d) => ({
          value: 1,
          itemStyle: {
            color: !d.gatewayUp ? COLORS.red :
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
          data: [{ xAxis: lastLabel }],
          label: { show: false },
        },
      }],
    };
  }, [data]);

  return <BaseChart option={option} height={50} testId="uptime-chart" />;
}
