import { COLORS, CARD_SHADOW, esc, tag } from './constants.js';
import type { SnapshotData, SnapshotSession, Detail } from '../snapshot-types.js';

function renderSessionCard(sess: SnapshotSession, includeSubs: boolean): string {
  const active = sess.status === 'active';
  const dotCls = active ? `bg-[${COLORS.emeraldHex}] pulse` : `bg-[${COLORS.textMuted}]`;
  const borderCls = active ? `border-[${COLORS.activeBorder}]` : `border-[${COLORS.borderAlpha}]`;
  const barColor = 'bg-[rgba(56,189,248,0.7)]';
  const pct = sess.usagePercent != null ? Math.round(sess.usagePercent) : 0;

  let tags = tag(sess.modelDisplay || '', COLORS.tagModel);
  tags += tag(sess.channel || '', COLORS.tagChannel);
  if (sess.subAgentCount > 0) {
    tags += tag(`${sess.subAgentCount} sub`, COLORS.tagSub);
  }

  let subTree = '';
  if (includeSubs && sess.subAgents && sess.subAgents.length > 0) {
    const maxSubs = 4;
    const displayed = sess.subAgents.slice(0, maxSubs);
    const remaining = sess.subAgents.length > maxSubs ? sess.subAgents.length - maxSubs : 0;
    subTree = `<div class="ml-3 pl-3 tree-line space-y-1.5 mt-2.5">
      ${displayed
        .map(
          (sub) => `
        <div class="relative tree-branch flex items-center justify-between py-1">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${sub.completed ? `bg-[${COLORS.emeraldHex}]` : sub.status === 'active' || sub.status === 'running' ? `bg-[${COLORS.emeraldHex}] pulse` : `bg-[${COLORS.textMuted}]`}"></span>
            <span class="text-[#d4d4d8] text-xs">${esc(sub.name)}</span>
            ${sub.completed ? `<span class="text-[${COLORS.emeraldHex}] text-[10px]">✓</span>` : ''}
          </div>
          <span class="text-[${COLORS.textDim}] text-[10px]">${esc(sub.updatedAt)}</span>
        </div>
      `,
        )
        .join('')}
      ${remaining > 0 ? `<div class="text-[${COLORS.textDim}] text-[10px] pl-4">+${remaining} more sub-agents</div>` : ''}
    </div>`;
  }

  return `
    <div class="bg-[${COLORS.cardBgSubtle}] border ${borderCls} rounded-xl px-4 py-2.5" style="${CARD_SHADOW}">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full ${dotCls}"></span>
          <span class="text-[${COLORS.textPrimary}] text-sm font-medium">${esc(sess.name)}</span>
        </div>
        <span class="text-[${COLORS.textDim}] text-xs">${esc(sess.updatedAt)}</span>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">${tags}</div>
        <div class="flex items-center gap-1.5">
          <span class="text-[${COLORS.textMuted}] text-xs font-mono">${esc(sess.totalTokensDisplay)}</span>
          <div class="w-10 h-[5px] rounded-full bg-[${COLORS.trackBg}] overflow-hidden"><div class="h-full rounded-full ${barColor}" style="width:${pct}%"></div></div>
          <span class="text-[${COLORS.textDim}] text-[10px]">${pct}%</span>
        </div>
      </div>
      ${subTree}
    </div>`;
}

export function renderSessions(data: SnapshotData, detail: Detail): string {
  const sessions = data.sessions;
  if (!sessions || sessions.length === 0) return '';

  const activeCount = data.summary.activeSessions;
  const totalCount = data.summary.totalSessions;
  const includeSubs = detail === 'full';
  const remaining = detail === 'standard' ? totalCount - sessions.length : 0;

  return `
    <div class="px-4 pb-3">
      <div class="flex items-center justify-between mb-2.5">
        <span class="text-[${COLORS.textSecondary}] text-xs font-semibold tracking-wider uppercase">${detail === 'full' ? 'Active Sessions' : 'Sessions'}</span>
        <span class="text-[${COLORS.textDim}] text-xs">${activeCount} active · ${totalCount} total</span>
      </div>
      <div class="space-y-2">
        ${sessions.map((s) => renderSessionCard(s, includeSubs)).join('')}
      </div>
      ${remaining > 0 ? `<div class="text-center mt-2.5 text-[${COLORS.textDim}] text-xs">+${remaining} more sessions</div>` : ''}
    </div>`;
}
