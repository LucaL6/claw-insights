import { COLORS, CARD_SHADOW, esc } from './constants.js';
import type { SnapshotData } from '../snapshot-types.js';

function errorBadge(level: string): string {
  if (level === 'error')
    return `<span class="px-1.5 py-0.5 bg-[rgba(239,68,68,0.1)] text-[${COLORS.redHex}] border border-[rgba(239,68,68,0.2)] text-[9px] rounded font-medium shrink-0">error</span>`;
  if (level === 'warn')
    return `<span class="px-1.5 py-0.5 bg-[rgba(251,191,36,0.1)] text-[${COLORS.amberHex}] border border-[rgba(251,191,36,0.2)] text-[9px] rounded font-medium shrink-0">warn</span>`;
  return `<span class="px-1.5 py-0.5 bg-[rgba(113,113,122,0.08)] text-[${COLORS.textSecondary}] border border-[rgba(113,113,122,0.12)] text-[9px] rounded font-medium shrink-0">${esc(level)}</span>`;
}

export function renderErrors(data: SnapshotData): string {
  const errors = data.recentErrors;
  if (!errors || errors.length === 0) return '';

  const displayed = errors.slice(0, 5);
  const moreCount = errors.length > 5 ? errors.length - 5 : 0;

  return `
    <div class="px-4 pb-3">
      <div class="bg-[${COLORS.cardBgSubtle}] border border-[${COLORS.borderAlpha}] rounded-xl p-4" style="${CARD_SHADOW}">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[${COLORS.textSecondary}] text-xs font-semibold tracking-wider uppercase">Recent Errors</span>
          <span class="text-[${COLORS.textDim}] text-xs">${displayed.length} of ${errors.length}</span>
        </div>
        <div class="space-y-2">
          ${displayed
            .map((e) => {
              const t = e.timestamp
                ? new Date(e.timestamp).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })
                : '';
              return `<div class="flex items-start gap-2.5">
              <span class="text-[${COLORS.textDim}] text-[11px] font-mono w-11 shrink-0">${esc(t)}</span>
              ${errorBadge(e.type || 'error')}
              <span class="text-[${COLORS.textMuted}] text-[11px] w-14 shrink-0">${esc(e.module)}</span>
              <span class="text-[#d4d4d8] text-[11px] truncate">${esc(e.message)}</span>
            </div>`;
            })
            .join('')}
        </div>
        ${moreCount > 0 ? `<div class="text-center mt-3 text-[${COLORS.textDim}] text-xs">${moreCount} more errors in last 24h</div>` : ''}
      </div>
    </div>`;
}
