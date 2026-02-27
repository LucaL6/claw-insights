import type { EChartsOption } from 'echarts';

import { buildCategoryXAxis, CHART_GRID, COMPACT_Y_AXIS, tooltipHtml } from './shared';

const VIOLET = '#a78bfa';

interface ConversationBucket {
  bucket: number;
  label: string;
  turns: number;
}

export function buildConversationsOption(data: ConversationBucket[], footerText: string): EChartsOption {
  const labels = data.map((d) => d.label);

  return {
    grid: CHART_GRID,
    xAxis: buildCategoryXAxis(labels),
    yAxis: { ...COMPACT_Y_AXIS, minInterval: 1 },
    tooltip: {
      appendToBody: true,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = (params as Array<{ name: string; value: number }>)[0];
        return tooltipHtml({
          title: p.name,
          rows: [{ color: VIOLET, label: 'Turns', value: String(p.value) }],
          footer: footerText,
        });
      },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => d.turns),
        barMaxWidth: 24,
        itemStyle: {
          color: VIOLET,
          borderRadius: [2, 2, 0, 0],
          opacity: 0.7,
        },
        emphasis: {
          itemStyle: { opacity: 1 },
        },
      },
    ],
  };
}
