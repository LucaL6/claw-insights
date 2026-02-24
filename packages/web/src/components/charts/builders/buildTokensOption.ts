import type { EChartsOption } from 'echarts';

import { getModelColor, shortModelName } from '../core/model-utils';
import { buildCategoryXAxis, CHART_GRID, COMPACT_Y_AXIS, tooltipHtml } from './shared';

const TOKEN_Y_AXIS = {
  ...COMPACT_Y_AXIS,
  axisLabel: {
    ...COMPACT_Y_AXIS.axisLabel,
    formatter: (v: number) => (v === 0 ? '0' : v >= 1000 ? `${(v / 1000).toFixed(1)}M` : `${v}k`),
  },
};

interface ModelTokens {
  model: string;
  tokensK: number;
}
interface TokenBucket {
  bucket: number;
  label: string;
  tokensK: number;
  tokensByModel?: ModelTokens[];
}

export function buildTokensOption(
  data: TokenBucket[],
  selectedModel: string | null,
  footerText: string,
): EChartsOption {
  const labels = data.map((d) => d.label);

  // Collect unique models
  const modelSet = new Set<string>();
  for (const d of data) {
    for (const mt of d.tokensByModel ?? []) {modelSet.add(mt.model);}
  }
  const models = Array.from(modelSet).sort();

  // No model data → single bar
  if (models.length === 0) {
    return {
      grid: CHART_GRID,
      xAxis: buildCategoryXAxis(labels),
      yAxis: TOKEN_Y_AXIS,
      tooltip: {
        appendToBody: true,
        trigger: 'axis',
        formatter: (params: unknown) => {
          const p = (params as Array<{ name: string; value: number }>)[0];
          if (!p) {return '';} // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- defensive: params cast from unknown
          return tooltipHtml({
            title: p.name,
            rows: [{ color: '#38bdf8', label: 'tokens', value: `${p.value.toFixed(1)}k` }],
            footer: footerText,
          });
        },
      },
      series: [
        {
          type: 'bar',
          data: data.map((d) => d.tokensK),
          barMaxWidth: 12,
          itemStyle: { color: '#38bdf8', borderRadius: [2, 2, 0, 0] },
        },
      ],
    };
  }

  // Stacked model bars
  const visibleModels = selectedModel ? models.filter((m) => m === selectedModel) : models;

  const series = visibleModels.map((model, idx) => ({
    name: shortModelName(model),
    type: 'bar' as const,
    stack: 'tokens',
    barMaxWidth: 12,
    data: data.map((d) => {
      const mt = (d.tokensByModel ?? []).find((m) => m.model === model);
      return mt ? mt.tokensK : 0;
    }),
    itemStyle: {
      color: getModelColor(model),
      borderRadius:
        idx === visibleModels.length - 1
          ? ([2, 2, 0, 0] as [number, number, number, number])
          : ([0, 0, 0, 0] as [number, number, number, number]),
    },
  }));

  return {
    grid: CHART_GRID,
    xAxis: buildCategoryXAxis(labels),
    yAxis: TOKEN_Y_AXIS,
    tooltip: {
      appendToBody: true,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = params as Array<{ seriesName: string; value: number; color: string; name: string }>;
        if (!items.length) {return '';}
        const rows = items
          .filter((i) => i.value > 0)
          .map((i) => ({
            color: i.color,
            label: i.seriesName,
            value: `${i.value.toFixed(1)}k`,
          }));
        const total = items.reduce((s, i) => s + i.value, 0);
        const extra = items.length > 1 ? `Total: <b>${total.toFixed(1)}k</b>` : undefined;
        return tooltipHtml({ title: items[0].name, rows, footer: footerText, extra });
      },
    },
    series,
  };
}
