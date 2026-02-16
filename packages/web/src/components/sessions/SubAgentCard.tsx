import { useState } from 'react';
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
  const [hovered, setHovered] = useState(false);
  const isDone = status === 'DONE' || status === 'FAILED';
  const completionMark = status === 'DONE' ? ' ✓' : status === 'FAILED' ? ' ✕' : '';
  const isStarting = totalTokens === 0 && status === 'ACTIVE';

  return (
    <div className="relative flex">
      <div
        className={`absolute left-0 top-0 ${isLast ? 'h-4' : 'bottom-0'} w-px`}
        style={{ backgroundColor: 'var(--tree-line)' }}
      />
      <div className="absolute left-0 top-4 w-3 h-px" style={{ backgroundColor: 'var(--tree-line)' }} />

      <div
        className={`ml-4 flex-1 rounded-lg px-2.5 py-2 transition-all cursor-pointer ${isDone ? 'opacity-60' : ''}`}
        style={{
          backgroundColor: 'var(--subagent-bg)',
          border: `1px solid ${
            isDone ? 'var(--border-subtle)'
            : status === 'FAILED' ? 'var(--session-failed-border)'
            : hovered ? 'var(--subagent-hover-border)' : 'var(--subagent-border)'
          }`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {isStarting ? (
          <div className="flex items-center gap-2">
            <StatusDot status={status} size="sm" />
            <span className="mono text-[13px]" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
            <span className="text-[11px] animate-pulse" style={{ color: 'var(--text-dim)' }}>Starting...</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusDot status={status} size="sm" />
              <span className={`mono text-[13px] font-medium truncate`} style={{ color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                {displayName}{completionMark}
              </span>
              <TagPill variant="model" size="sm"><span className="mono">{formatModel(model)}</span></TagPill>
              {channel && <TagPill variant="channel" size="sm">{channel}</TagPill>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="mono text-[12px]" style={{ color: isDone ? 'var(--text-dim)' : 'var(--text-muted)' }}>
                {(totalTokens / 1000).toFixed(1)}k
              </span>
              <InlineProgress percent={usagePercent} width={32} height={2} />
              <span className="text-[10px] w-12 text-right" style={{ color: 'var(--text-dim)' }}>{relativeTime(updatedAt)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
