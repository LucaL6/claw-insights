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
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  IDLE: 'bg-zinc-500',
  DONE: 'bg-blue-500',
  FAILED: 'bg-red-500',
};

export function SessionCard({ displayName, model, channel, totalTokens, contextTokens, usagePercent, status, kind, updatedAt }: Props) {
  const barColor = usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-cyan-500';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors">
      {/* Row 1: name + time */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[status] ?? 'bg-zinc-600'}`} />
          <span className="text-sm font-medium text-zinc-200 truncate">{displayName}</span>
          {kind === 'cron' && (
            <span className="text-[9px] bg-violet-900/50 text-violet-400 px-1 rounded flex-shrink-0">CRON</span>
          )}
          {usagePercent > 80 && (
            <span className="text-[9px] bg-amber-900/50 text-amber-400 px-1 rounded ml-1">⚠ NEAR LIMIT</span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600 flex-shrink-0">{relativeTime(updatedAt)}</span>
      </div>

      {/* Row 2: model · kind · channel */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-2">
        <span className="font-mono">{model.replace('claude-', '').replace('-20250514', '')}</span>
        <span>·</span>
        <span>{kind}</span>
        {channel && <><span>·</span><span>{channel}</span></>}
      </div>

      {/* Token bar */}
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(usagePercent, 100)}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
        <span>{(totalTokens / 1000).toFixed(1)}k tokens</span>
        <span>{(contextTokens / 1000).toFixed(0)}k ctx</span>
        <span>{usagePercent.toFixed(0)}%</span>
      </div>
    </div>
  );
}
