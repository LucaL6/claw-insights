import { COLORS, CARD_SHADOW, sparklineHtml, uptimeStripHtml } from './constants.js';
import type { SnapshotData, Detail } from '../snapshot-types.js';

interface MetricItem {
  key: string;
  label: string;
  rangeLabel: string;
  color: string;
  sparkKey: 'sessions' | 'tokens' | 'errors' | 'uptime';
  valueCls: string;
}

const METRIC_ITEMS: MetricItem[] = [
  {
    key: 'activeSessions',
    label: 'Active Sessions',
    rangeLabel: 'peak 24h',
    color: COLORS.cyan,
    sparkKey: 'sessions',
    valueCls: `text-[${COLORS.textPrimary}]`,
  },
  {
    key: 'tokensDisplay',
    label: 'Tokens',
    rangeLabel: '24h total',
    color: COLORS.emerald,
    sparkKey: 'tokens',
    valueCls: 'text-emerald-400',
  },
  {
    key: 'errors',
    label: 'Errors',
    rangeLabel: '24h total',
    color: COLORS.red,
    sparkKey: 'errors',
    valueCls: 'text-red-400',
  },
  {
    key: 'uptimeDisplay',
    label: 'Uptime',
    rangeLabel: '24h',
    color: COLORS.emerald,
    sparkKey: 'uptime',
    valueCls: 'text-emerald-400',
  },
];

export function renderMetrics(data: SnapshotData, detail: Detail): string {
  const s = {
    ...data.summary,
    uptimeDisplay: data.summary.uptimePercent != null ? data.summary.uptimePercent + '%' : '—',
  } as Record<string, unknown>;
  const sp = data.sparklines;

  if (detail === 'compact') {
    // 2x2 grid with sparklines
    return `
      <div class="grid grid-cols-2 gap-3 p-4">
        ${METRIC_ITEMS.map(
          (m) => `
          <div class="bg-[${COLORS.cardBg}] border border-[${COLORS.borderAlpha}] rounded-xl p-4" style="${CARD_SHADOW}">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[${COLORS.textMuted}] text-xs font-medium">${m.label}</span>
              <span class="text-[${COLORS.textDim}] text-[10px]">${m.rangeLabel}</span>
            </div>
            <div class="${m.valueCls} text-[28px] font-bold leading-none mb-3">${s[m.key] != null ? s[m.key] : '—'}</div>
            <div class="h-[40px]" style="height:40px">${m.sparkKey === 'uptime' ? uptimeStripHtml(sp.uptime) : sparklineHtml(sp[m.sparkKey] as number[], m.color)}</div>
          </div>
        `,
        ).join('')}
      </div>`;
  }

  // standard + full: 4-col compact row
  return `
    <div class="grid grid-cols-4 gap-2.5 px-4 pt-4 pb-3">
      ${METRIC_ITEMS.map(
        (m) => `
        <div class="bg-[${COLORS.cardBg}] border border-[${COLORS.borderAlpha}] rounded-lg px-3 py-2.5 text-center" style="${CARD_SHADOW}">
          <div class="text-[${COLORS.textMuted}] text-[10px] font-medium">${m.label}</div>
          <div class="${m.valueCls} text-xl font-bold">${s[m.key] != null ? s[m.key] : '—'}</div>
        </div>
      `,
      ).join('')}
    </div>`;
}
