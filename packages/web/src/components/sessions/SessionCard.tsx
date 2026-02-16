import { formatModel } from '../../utils/formatModel';
import { StatusDot } from './shared/StatusDot';
import { TagPill } from './shared/TagPill';
import { InlineProgress } from './shared/InlineProgress';
import { relativeTime } from './shared/relativeTime';
import { BORDER_BY_STATUS } from './shared/constants';

interface Props {
  displayName: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  usagePercent: number;
  status: string;
  kind: string;
  updatedAt: number;
  subAgentCount?: number;
  onToggle?: () => void;
  expanded?: boolean;
  hasChildren?: boolean;
}

export function SessionCard({
  displayName, model, channel, totalTokens, usagePercent,
  status, kind, updatedAt, subAgentCount, onToggle, expanded, hasChildren,
}: Props) {
  const borderClass = status === 'ACTIVE' && usagePercent > 80
    ? BORDER_BY_STATUS.ACTIVE_WARN
    : BORDER_BY_STATUS[status] ?? BORDER_BY_STATUS.IDLE;

  return (
    <div className={`bg-zinc-900/60 border ${borderClass} rounded-xl p-4 transition-all cursor-pointer`}>
      {/* Row 1: status dot + name + kind + toggle + time */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
              className={`text-zinc-500 hover:text-zinc-300 transition-transform ${expanded ? '' : '-rotate-90'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          <StatusDot status={status} />
          <span className="text-[15px] text-zinc-100 font-semibold truncate">{displayName}</span>
          {kind === 'cron' && <TagPill variant="cron">CRON</TagPill>}
        </div>
        <span className="text-[12px] text-zinc-500 flex-shrink-0">{relativeTime(updatedAt)}</span>
      </div>

      {/* Row 2: tag pills + token + inline progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <TagPill variant="model"><span className="mono">{formatModel(model)}</span></TagPill>
          {channel && <TagPill variant="channel">{channel}</TagPill>}
          <TagPill variant="kind">{kind}</TagPill>
          {subAgentCount !== undefined && subAgentCount > 0 && (
            <TagPill variant="sub">{subAgentCount} sub</TagPill>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="mono text-[13px] font-semibold text-zinc-300">{(totalTokens / 1000).toFixed(1)}k</span>
          <InlineProgress percent={usagePercent} />
        </div>
      </div>
    </div>
  );
}
