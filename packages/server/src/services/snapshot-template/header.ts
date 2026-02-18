import { COLORS, LIGHTHOUSE_SVG, esc } from './constants.js';
import type { SnapshotData, Detail } from '../snapshot-types.js';

export function renderHeader(data: SnapshotData, detail: Detail): string {
  const gw = data.gateway;
  const isUp = gw.status === 'up';

  const statusBadge = isUp
    ? `<span class="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse"></span>UP</span>`
    : `<span class="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-medium"><span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>DOWN</span>`;

  const version =
    detail !== 'compact' ? `<span class="text-[${COLORS.textDim}] text-xs ml-1">${esc(gw.version)}</span>` : '';

  const systemInfo =
    detail === 'full'
      ? `${gw.cpu != null ? `<span class="text-[${COLORS.textMuted}] text-xs">CPU ${esc(String(gw.cpu))}</span>` : ''}${gw.memoryMB != null ? `<span class="text-[${COLORS.textMuted}] text-xs">MEM ${esc(gw.memoryMB + 'MB')}</span>` : ''}`
      : '';

  return `
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-[${COLORS.borderAlpha}]">
      <div class="flex items-center gap-2.5">
        ${LIGHTHOUSE_SVG}
        <span class="text-[${COLORS.textPrimary}] font-semibold text-[15px]">Claw Insights</span>
        ${statusBadge}
        ${version}
      </div>
      <div class="flex items-center gap-${detail === 'full' ? '3' : '2'}">
        ${systemInfo}
        <span class="px-1.5 py-0.5 rounded bg-[${COLORS.trackBg}] text-${detail === 'full' ? '[#a1a1aa]' : 'zinc-400'} text-[10px] font-medium">${esc(data.range)}</span>
        <span class="text-[${COLORS.textMuted}] text-xs font-medium">${esc(data.time)}</span>
      </div>
    </div>`;
}
