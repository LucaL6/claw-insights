import { formatModel } from '../../utils/formatModel';
import { StatusDot } from './shared/StatusDot';
import { TagPill } from './shared/TagPill';
import { InlineProgress } from './shared/InlineProgress';
import { relativeTime } from './shared/relativeTime';

interface Props {
  displayName: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  usagePercent: number;
  status: string;
  updatedAt: number;
  isLast: boolean;
}

export function SubAgentCard({
  displayName, model, channel, totalTokens, usagePercent,
  status, updatedAt, isLast,
}: Props) {
  const isDone = status === 'DONE' || status === 'FAILED';
  const completionMark = status === 'DONE' ? ' ✓' : status === 'FAILED' ? ' ✕' : '';
  const isStarting = totalTokens === 0 && status === 'ACTIVE';

  return (
    <div className="relative flex">
      {/* Tree connector lines */}
      <div className={`absolute left-0 top-0 ${isLast ? 'h-4' : 'bottom-0'} w-px bg-cyan-500/20`} />
      <div className="absolute left-0 top-4 w-3 h-px bg-cyan-500/20" />

      {/* Card — single row compact */}
      <div className={`ml-4 flex-1 bg-zinc-900/40 border rounded-lg px-2.5 py-2 transition-all cursor-pointer ${
        isDone ? 'opacity-60 border-zinc-800/40' : status === 'FAILED' ? 'border-red-500/10' : 'border-cyan-500/10 hover:border-cyan-500/20'
      }`}>
        {isStarting ? (
          <div className="flex items-center gap-2">
            <StatusDot status={status} size="sm" />
            <span className="mono text-[13px] text-zinc-200">{displayName}</span>
            <span className="text-[11px] text-zinc-600 animate-pulse">Starting...</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusDot status={status} size="sm" />
              <span className={`mono text-[13px] font-medium truncate ${isDone ? 'text-zinc-400' : 'text-zinc-200'}`}>
                {displayName}{completionMark}
              </span>
              <TagPill variant="model" size="sm"><span className="mono">{formatModel(model)}</span></TagPill>
              {channel && <TagPill variant="channel" size="sm">{channel}</TagPill>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`mono text-[12px] ${isDone ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {(totalTokens / 1000).toFixed(1)}k
              </span>
              <InlineProgress percent={usagePercent} width={32} height={2} />
              <span className="text-[10px] text-zinc-600 w-12 text-right">{relativeTime(updatedAt)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
