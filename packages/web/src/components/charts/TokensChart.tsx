import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { CHART_GRID, COMPACT_Y_AXIS, bucketLabelInterval, getModelColor, shortModelName } from './echarts-theme';

/** Y-axis for token charts: values are already in k, so always show "k" suffix */
const TOKEN_Y_AXIS = {
  ...COMPACT_Y_AXIS,
  axisLabel: {
    ...COMPACT_Y_AXIS.axisLabel,
    formatter: (v: number) => v === 0 ? '0' : v >= 1000 ? `${(v / 1000).toFixed(1)}M` : `${v}k`,
  },
};
import type { EChartsOption } from 'echarts';
import { TOOLTIPS } from './metricsTooltips';

interface ModelTokens {
  model: string;
  tokensK: number;
}

interface BucketData {
  bucket: number;
  label: string;
  tokensK: number;
  tokensByModel?: ModelTokens[];
}

interface Props {
  data: BucketData[];
  selectedModel?: string | null;
}

export function TokensChart({ data, selectedModel }: Props) {
  const option = useMemo((): EChartsOption => {
    const labels = data.map((d) => d.label);

    // Collect all unique models
    const modelSet = new Set<string>();
    for (const d of data) {
      for (const mt of d.tokensByModel ?? []) {
        modelSet.add(mt.model);
      }
    }
    const models = Array.from(modelSet).sort();

    // Fallback: no model data yet → single bar series
    if (models.length === 0) {
      return {
        grid: CHART_GRID,
        xAxis: {
          type: 'category',
          data: labels,
          axisLabel: { interval: bucketLabelInterval(data.length) },
        },
        yAxis: TOKEN_Y_AXIS,
        tooltip: { trigger: 'axis', formatter: (params: unknown) => {
          const p = (params as Array<{ name: string; value: number }>)[0];
          if (!p) return '';
          return `<b>${p.name}</b><br/><b style="color:#38bdf8">${p.value.toFixed(1)}k</b> tokens`
            + `<div style="color:#71717a;font-size:10px;margin-top:4px">${TOOLTIPS.chartFooter.tokens}</div>`;
        }},
        series: [{
          type: 'bar',
          data: data.map(d => d.tokensK),
          barMaxWidth: 12,
          itemStyle: { color: '#38bdf8', borderRadius: [2, 2, 0, 0] },
        }],
      };
    }

    // Filter if specific model selected
    const visibleModels = selectedModel
      ? models.filter(m => m === selectedModel)
      : models;

    const series = visibleModels.map((model, idx) => ({
      name: shortModelName(model),
      type: 'bar' as const,
      stack: 'tokens',
      barMaxWidth: 12,
      data: data.map(d => {
        const mt = (d.tokensByModel ?? []).find(m => m.model === model);
        return mt ? Number(mt.tokensK) : 0;
      }),
      itemStyle: {
        color: getModelColor(model),
        borderRadius: idx === visibleModels.length - 1
          ? [2, 2, 0, 0] as [number, number, number, number]
          : [0, 0, 0, 0] as [number, number, number, number],
      },
    }));

    return {
      grid: CHART_GRID,
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { interval: bucketLabelInterval(data.length) },
      },
      yAxis: TOKEN_Y_AXIS,
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number; color: string; name: string }>;
          if (!items?.length) return '';
          let html = `<b>${items[0].name}</b>`;
          let total = 0;
          for (const item of items) {
            if (item.value > 0) {
              html += `<br/><span style="color:${item.color}">■</span> ${item.seriesName}: <b>${item.value.toFixed(1)}k</b>`;
              total += item.value;
            }
          }
          if (items.length > 1) html += `<br/>Total: <b>${total.toFixed(1)}k</b>`;
          html += `<div style="color:#71717a;font-size:10px;margin-top:4px">${TOOLTIPS.chartFooter.tokens}</div>`;
          return html;
        },
      },
      legend: visibleModels.length > 1 ? {
        bottom: 0,
        textStyle: { color: '#71717a', fontSize: 9 },
        itemWidth: 8,
        itemHeight: 8,
      } : undefined,
      series,
    };
  }, [data, selectedModel]);

  return <BaseChart option={option} height={120} testId="tokens-chart" />;
}
