import type { EChartsOption } from 'echarts';

import { CHART_FONT } from '../core/echarts-theme';
import { COLORS } from '../core/model-utils';
import { buildCategoryXAxis, tooltipHtml } from './shared';

interface UptimeBucket {
  bucket: number;
  label: string;
  gatewayUp: boolean;
  restartEvent: boolean;
}

interface UptimeLabels {
  up: string;
  down: string;
  restart: string;
}

const DEFAULT_UPTIME_LABELS: UptimeLabels = { up: 'UP', down: 'DOWN', restart: 'restart' };

export function buildUptimeOption(data: UptimeBucket[], i18n: UptimeLabels = DEFAULT_UPTIME_LABELS): EChartsOption {
  const labels = data.map((d) => d.label);
  const lastLabel = labels[labels.length - 1] ?? '';

  return {
    grid: { top: 4, right: 12, bottom: 16, left: 36, containLabel: false },
    xAxis: buildCategoryXAxis(labels, {
      axisLabel: { interval: 0, fontSize: CHART_FONT.axis },
      axisLine: { show: false },
      axisTick: { show: false },
    }),
    yAxis: { show: false, max: 1 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = (params as Array<{ dataIndex: number; name: string }>)[0];
        const d = data[p.dataIndex];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive: array index
        if (!d) {
          return '';
        }
        const status = d.gatewayUp
          ? `<b style="color:#34d399">${i18n.up}</b>`
          : `<b style="color:#ef4444">${i18n.down}</b>`;
        const extra = d.restartEvent ? `<span style="color:#fbbf24">↻ ${i18n.restart}</span>` : undefined;
        return tooltipHtml({ title: `${p.name} ${status}`, rows: [], extra });
      },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => ({
          value: 1,
          itemStyle: {
            color: !d.gatewayUp ? COLORS.red : d.restartEvent ? COLORS.amber : 'rgba(52,211,153,0.45)',
            borderColor: !d.gatewayUp ? COLORS.red : d.restartEvent ? COLORS.amber : 'transparent',
            borderWidth: d.gatewayUp && !d.restartEvent ? 0 : 1,
            borderRadius: 2,
            ...(!d.gatewayUp
              ? { shadowBlur: 6, shadowColor: 'rgba(239,68,68,0.3)' }
              : d.restartEvent
                ? { shadowBlur: 6, shadowColor: 'rgba(251,191,36,0.3)' }
                : {}),
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
      },
    ],
  };
}
