function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

interface Props {
  displayName: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  contextTokens: number;
  usagePercent: number;
  status: string;
  kind: string;
  updatedAt: number;
  subAgentCount?: number;
  onToggle?: () => void;
  expanded?: boolean;
  hasChildren?: boolean;
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400 pulse-dot',
  IDLE: 'bg-zinc-500',
  DONE: 'bg-blue-500',
  FAILED: 'bg-red-500',
};

export function SessionCard({
  displayName, model, channel, totalTokens, contextTokens, usagePercent,
  status, kind, updatedAt, subAgentCount, onToggle, expanded, hasChildren,
}: Props) {
  const nearLimit = usagePercent > 80;
  const barGradient = nearLimit
    ? 'bg-gradient-to-r from-orange-500 to-red-500'
    : usagePercent > 50
      ? 'bg-gradient-to-r from-amber-500 to-amber-400'
      : 'bg-gradient-to-r from-emerald-500 to-emerald-400';
  const borderColor = nearLimit ? 'border-orange-500/20 hover:border-orange-500/30' : 'border-zinc-800/60 hover:border-zinc-700';
  const percentColor = nearLimit ? 'text-orange-400' : 'text-zinc-500';

  return (
    <div className={`bg-zinc-900/60 border ${borderColor} rounded-xl p-3.5 transition-all cursor-pointer`}>
      {/* Row 1: chevron + dot + name + badges + time */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {/* Chevron for groups */}
          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
              className={`text-zinc-500 hover:text-zinc-300 transition-transform ${expanded ? '' : '-rotate-90'}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status] ?? 'bg-zinc-600'}`} />
          <span className="mono text-sm text-zinc-100 font-medium truncate">{displayName}</span>
          {kind === 'cron' && (
            <span className="text-[9px] bg-violet-900/50 text-violet-400 px-1 rounded flex-shrink-0">CRON</span>
          )}
          {subAgentCount !== undefined && subAgentCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/8 text-cyan-400/80 border border-cyan-500/15 rounded-full flex-shrink-0">
              {subAgentCount} sub
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {nearLimit && (
            <span className="text-[9px] px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded">⚠ NEAR LIMIT</span>
          )}
          <span className="text-[10px] text-zinc-500">{relativeTime(updatedAt)}</span>
        </div>
      </div>

      {/* Row 2: model · kind · channel */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-500 mb-2.5">
        <span>{model.replace('claude-', '').replace('-20250514', '')}</span>
        <span>·</span>
        <span>{kind}</span>
        {channel && <><span>·</span><span>{channel}</span></>}
      </div>

      {/* Progress bar with gradient */}
      <div className="flex items-center gap-2 mb-0.5">
        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${barGradient} rounded-full transition-all`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <span className={`mono text-[10px] ${percentColor} w-10 text-right`}>{usagePercent.toFixed(0)}%</span>
      </div>
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>{(totalTokens / 1000).toFixed(1)}k tokens</span>
        <span>{(contextTokens / 1000).toFixed(0)}k ctx</span>
      </div>
    </div>
  );
}
