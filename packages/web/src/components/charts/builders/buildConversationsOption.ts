import type { EChartsOption } from 'echarts';

import type { RoleFilter } from '../metrics/RoleSelector';
import { buildCategoryXAxis, CHART_GRID, COMPACT_Y_AXIS, tooltipHtml } from './shared';

const USER_COLOR = '#2dd4bf'; // teal-400
const ASSISTANT_COLOR = '#fb7185'; // rose-400

interface ConversationBucket {
  bucket: number;
  label: string;
  turns: number;
  userTurns: number;
  assistantTurns: number;
}

export function buildConversationsOption(
  data: ConversationBucket[],
  footerText: string,
  roleFilter: RoleFilter = 'all',
): EChartsOption {
  const labels = data.map((d) => d.label);

  if (roleFilter === 'user') {
    return {
      grid: CHART_GRID,
      xAxis: buildCategoryXAxis(labels),
      yAxis: { ...COMPACT_Y_AXIS, minInterval: 1 },
      tooltip: {
        appendToBody: true,
        trigger: 'axis',
        formatter: (params: unknown) => {
          const items = params as Array<{ name: string; value: number }>;
          return tooltipHtml({
            title: items[0].name,
            rows: [{ color: USER_COLOR, label: 'User', value: String(items[0].value) }],
            footer: footerText,
          });
        },
      },
      series: [
        {
          name: 'User',
          type: 'bar',
          data: data.map((d) => d.userTurns),
          barMaxWidth: 24,
          itemStyle: { color: USER_COLOR, borderRadius: [2, 2, 0, 0] },
        },
      ],
    };
  }

  if (roleFilter === 'assistant') {
    return {
      grid: CHART_GRID,
      xAxis: buildCategoryXAxis(labels),
      yAxis: { ...COMPACT_Y_AXIS, minInterval: 1 },
      tooltip: {
        appendToBody: true,
        trigger: 'axis',
        formatter: (params: unknown) => {
          const items = params as Array<{ name: string; value: number }>;
          return tooltipHtml({
            title: items[0].name,
            rows: [{ color: ASSISTANT_COLOR, label: 'OpenClaw', value: String(items[0].value) }],
            footer: footerText,
          });
        },
      },
      series: [
        {
          name: 'OpenClaw',
          type: 'bar',
          data: data.map((d) => d.assistantTurns),
          barMaxWidth: 24,
          itemStyle: { color: ASSISTANT_COLOR, borderRadius: [2, 2, 0, 0] },
        },
      ],
    };
  }

  // All: stacked
  return {
    grid: CHART_GRID,
    xAxis: buildCategoryXAxis(labels),
    yAxis: { ...COMPACT_Y_AXIS, minInterval: 1 },
    tooltip: {
      appendToBody: true,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = params as Array<{ name: string; seriesName: string; value: number; color: string }>;
        const total = items.reduce((s, i) => s + i.value, 0);
        return tooltipHtml({
          title: items[0].name,
          rows: [
            { color: USER_COLOR, label: 'User', value: String(items[0]?.value ?? 0) },
            { color: ASSISTANT_COLOR, label: 'OpenClaw', value: String(items[1]?.value ?? 0) },
            { color: '#d1d5db', label: 'Total', value: String(total) },
          ],
          footer: footerText,
        });
      },
    },
    series: [
      {
        name: 'User',
        type: 'bar',
        stack: 'turns',
        data: data.map((d) => d.userTurns),
        barMaxWidth: 24,
        itemStyle: { color: USER_COLOR, borderRadius: [0, 0, 0, 0] },
      },
      {
        name: 'OpenClaw',
        type: 'bar',
        stack: 'turns',
        data: data.map((d) => d.assistantTurns),
        barMaxWidth: 24,
        itemStyle: { color: ASSISTANT_COLOR, borderRadius: [2, 2, 0, 0] },
      },
    ],
  };
}
