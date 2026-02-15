function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

interface Props {
  label: string;
  status: string;
  totalTokens: number;
  updatedAt: number;
  isLast: boolean;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-emerald-500/10 text-emerald-400', text: 'text-emerald-400', label: 'RUNNING' },
  DONE: { bg: 'bg-zinc-700/50 text-zinc-500', text: 'text-zinc-500', label: 'DONE' },
  FAILED: { bg: 'bg-red-500/10 text-red-400', text: 'text-red-400', label: 'FAILED' },
  IDLE: { bg: 'bg-zinc-700/50 text-zinc-500', text: 'text-zinc-500', label: 'IDLE' },
};

const DOT_COLOR: Record<string, string> = {
  ACTIVE: 'bg-emerald-400 pulse-dot',
  DONE: 'bg-zinc-500',
  FAILED: 'bg-red-400',
  IDLE: 'bg-zinc-500',
};

const BAR_COLOR: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/60',
  DONE: 'bg-zinc-600',
  FAILED: 'bg-red-500/60',
  IDLE: 'bg-zinc-600',
};

const BORDER_COLOR: Record<string, string> = {
  ACTIVE: 'border-cyan-500/10 hover:border-cyan-500/20',
  DONE: 'border-zinc-800/40',
  FAILED: 'border-red-500/10',
  IDLE: 'border-zinc-800/40',
};

export function SubAgentCard({ label, status, totalTokens, updatedAt, isLast }: Props) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.IDLE;
  const dot = DOT_COLOR[status] ?? 'bg-zinc-500';
  const bar = BAR_COLOR[status] ?? 'bg-zinc-600';
  const border = BORDER_COLOR[status] ?? 'border-zinc-800/40';
  const isDone = status === 'DONE' || status === 'FAILED';
  const completionMark = status === 'DONE' ? ' ✓' : status === 'FAILED' ? ' ✕' : '';
  const tokenPct = Math.min((totalTokens / 200_000) * 100, 100); // assume 200k ctx

  return (
    <div className="relative flex">
      {/* Tree connector lines */}
      <div className={`absolute left-0 top-0 ${isLast ? 'h-4' : 'bottom-0'} w-px bg-cyan-500/20`} />
      <div className="absolute left-0 top-4 w-3 h-px bg-cyan-500/20" />

      {/* Card */}
      <div className={`ml-4 flex-1 bg-zinc-900/40 border ${border} rounded-lg p-2.5 transition-all cursor-pointer ${isDone ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <span className={`mono text-xs ${isDone ? 'text-zinc-400' : 'text-zinc-200'}`}>{label}</span>
            <span className={`text-[8px] px-1 py-0.5 rounded ${badge.bg}`}>{badge.label}</span>
          </div>
          <span className="text-[9px] text-zinc-600">{relativeTime(updatedAt)}</span>
        </div>
        {/* Token progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full ${bar} rounded-full`} style={{ width: `${tokenPct}%` }} />
          </div>
          <span className={`mono text-[9px] ${isDone ? 'text-zinc-600' : 'text-zinc-500'}`}>
            {(totalTokens / 1000).toFixed(0)}k{completionMark}
          </span>
        </div>
      </div>
    </div>
  );
}
