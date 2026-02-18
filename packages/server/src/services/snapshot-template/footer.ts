import { COLORS, esc } from './constants.js';
import type { SnapshotData } from '../snapshot-types.js';

export function renderFooter(data: SnapshotData): string {
  const ch = data.channels;
  const channelDots = ch
    .map((c) => {
      const ok = c.connected === true;
      return `<span class="flex items-center gap-1.5 text-xs text-[${COLORS.textSecondary}]"><span class="w-1.5 h-1.5 rounded-full ${ok ? `bg-[${COLORS.emeraldHex}]` : 'bg-[#ef4444]'}"></span>${esc(c.name)}</span>`;
    })
    .join('');
  const okCount = ch.filter((c) => c.connected).length;

  return `
    <div class="flex items-center justify-between px-5 py-3 border-t border-[${COLORS.borderAlpha}] bg-[${COLORS.cardBgFaint}]">
      <div class="flex items-center gap-4">${channelDots}</div>
      <span class="text-xs text-[${COLORS.textMuted}]">${okCount} channel${okCount !== 1 ? 's' : ''} OK</span>
    </div>`;
}
