import { COLORS, CARD_SHADOW, sparklineHtml, bucketChartHtml, esc } from './constants.js';
import type { SnapshotData, Detail } from '../snapshot-types.js';

function renderMiniCharts(data: SnapshotData): string {
  const sp = data.sparklines;
  return `
    <div class="grid grid-cols-2 gap-3 px-4 pb-3">
      <div class="bg-[${COLORS.cardBgSubtle}] border border-[${COLORS.borderAlpha}] rounded-xl p-3" style="${CARD_SHADOW}">
        <div class="text-[${COLORS.textMuted}] text-[10px] font-semibold tracking-wider uppercase mb-2">Tokens (24h)</div>
        <div class="h-[56px]" style="height:56px">${sparklineHtml(sp.tokens, COLORS.emerald)}</div>
      </div>
      <div class="bg-[${COLORS.cardBgSubtle}] border border-[${COLORS.borderAlpha}] rounded-xl p-3" style="${CARD_SHADOW}">
        <div class="text-[${COLORS.textMuted}] text-[10px] font-semibold tracking-wider uppercase mb-2">Errors (24h)</div>
        <div class="h-[56px]" style="height:56px">${sparklineHtml(sp.errors, COLORS.red)}</div>
      </div>
    </div>`;
}

function renderBucketCharts(data: SnapshotData): string {
  const s = data.summary;
  const buckets = data.buckets || [];
  const tokenPoints = buckets.map((b: Record<string, unknown>) => (b.tokensK as number) || (b.tokens as number) || 0);
  const errorPoints = buckets.map((b: Record<string, unknown>) => (b.errors as number) || 0);
  const uptimeStates = data.sparklines.uptime || [];

  let html = '';

  // Token consumption chart
  if (tokenPoints.length) {
    html += `
      <div class="px-4 pb-3">
        <div class="bg-[${COLORS.cardBgSubtle}] border border-[${COLORS.borderAlpha}] rounded-xl p-4" style="${CARD_SHADOW}">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[${COLORS.textSecondary}] text-xs font-semibold tracking-wider uppercase">Token Consumption (24h)</span>
            <span class="text-emerald-400 text-sm font-bold">${esc(s.tokensDisplay)}</span>
          </div>
          <div class="h-[120px] mb-2" style="height:120px">${bucketChartHtml(tokenPoints, 'rgba(167,139,250,0.85)', 'rgba(167,139,250,0.6)')}</div>
        </div>
      </div>`;
  }

  // Error chart
  if (errorPoints.length) {
    html += `
      <div class="px-4 pb-3">
        <div class="bg-[${COLORS.cardBgSubtle}] border border-[${COLORS.borderAlpha}] rounded-xl p-4" style="${CARD_SHADOW}">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[${COLORS.textSecondary}] text-xs font-semibold tracking-wider uppercase">Gateway Errors (24h)</span>
            <span class="text-[${COLORS.redHex}] text-sm font-bold">${esc(String(s.errors))}</span>
          </div>
          <div class="h-[96px] mb-2" style="height:96px">${bucketChartHtml(errorPoints, 'rgba(239,68,68,0.85)', 'rgba(239,68,68,0.6)')}</div>
        </div>
      </div>`;
  }

  // Uptime strip
  if (uptimeStates.length) {
    html += `
      <div class="px-4 pb-3">
        <div class="bg-[${COLORS.cardBgSubtle}] border border-[${COLORS.borderAlpha}] rounded-xl p-4" style="${CARD_SHADOW}">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[${COLORS.textSecondary}] text-xs font-semibold tracking-wider uppercase">Uptime</span>
            <span class="text-emerald-400 text-sm font-bold">${s.uptimePercent != null ? s.uptimePercent + '%' : '—'}</span>
          </div>
          <div class="flex gap-[2px] h-6 mb-2" style="height:24px">${uptimeStates
            .map((st) => {
              const color = st === 'up' ? 'bg-emerald-500/40' : st === 'degraded' ? 'bg-amber-500/50' : 'bg-red-500/50';
              return `<div class="flex-1 rounded ${color}"></div>`;
            })
            .join('')}</div>
        </div>
      </div>`;
  }

  return html;
}

export function renderCharts(data: SnapshotData, detail: Detail): string {
  if (detail === 'compact') return '';
  if (detail === 'standard') return renderMiniCharts(data);
  return renderBucketCharts(data); // full
}
