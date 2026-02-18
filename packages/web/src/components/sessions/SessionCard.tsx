import { useState } from 'react';
import { formatModel } from '../../utils/formatModel';
import { useI18n } from '../../i18n/context';
import { StatusDot } from './shared/StatusDot';
import { TagPill } from './shared/TagPill';
import { InlineProgress } from './shared/InlineProgress';
import { relativeTime } from './shared/relativeTime';
import { BORDER_BY_STATUS } from './shared/constants';
import { ChevronDownIcon } from '../ui/icons';

interface Props {
  displayName: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  usagePercent: number;
  status: string;
  kind?: string;
  updatedAt: number;
  /** 'primary' = full session card, 'compact' = sub-agent row */
  variant?: 'primary' | 'compact';
  /** Primary only: number of sub-agents */
  subAgentCount?: number;
  /** Primary only: expand/collapse children */
  onToggle?: () => void;
  expanded?: boolean;
  hasChildren?: boolean;
}

export function SessionCard({
  displayName,
  model,
  channel,
  totalTokens,
  usagePercent,
  status,
  kind,
  updatedAt,
  variant = 'primary',
  subAgentCount,
  onToggle,
  expanded,
  hasChildren,
}: Props) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);

  if (variant === 'compact') {
    return (
      <CompactCard
        {...{ displayName, model, channel, totalTokens, usagePercent, status, updatedAt, hovered, setHovered, t }}
      />
    );
  }

  const borderInfo =
    status === 'ACTIVE' && usagePercent > 80
      ? BORDER_BY_STATUS.ACTIVE_WARN
      : (BORDER_BY_STATUS[status] ?? BORDER_BY_STATUS.IDLE);

  return (
    <div
      className="rounded-xl p-4 transition-all cursor-pointer bg-surface shadow-card"
      style={{
        border: `1px solid ${hovered ? borderInfo.hoverBorder : borderInfo.border}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle?.();
              }}
              className={`transition-transform text-fg-muted ${expanded ? '' : '-rotate-90'}`}
            >
              <ChevronDownIcon />
            </button>
          )}
          <StatusDot status={status} />
          <span className="text-[15px] font-semibold truncate text-fg">{displayName}</span>
          {kind === 'cron' && <TagPill variant="cron">CRON</TagPill>}
        </div>
        <span className="text-[12px] flex-shrink-0 text-fg-muted">{relativeTime(updatedAt, t)}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <TagPill variant="model">
            <span className="mono">{formatModel(model)}</span>
          </TagPill>
          {channel && <TagPill variant="channel">{channel}</TagPill>}
          {kind && <TagPill variant="kind">{kind}</TagPill>}
          {subAgentCount !== undefined && subAgentCount > 0 && <TagPill variant="sub">{subAgentCount} sub</TagPill>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="mono text-[13px] font-semibold text-fg-secondary">{(totalTokens / 1000).toFixed(1)}k</span>
          <InlineProgress percent={usagePercent} />
        </div>
      </div>
    </div>
  );
}

/* ── Compact variant (sub-agent row) ── */

interface CompactProps {
  displayName: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  usagePercent: number;
  status: string;
  updatedAt: number;
  hovered: boolean;
  setHovered: (v: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function CompactCard({
  displayName,
  model,
  channel,
  totalTokens,
  usagePercent,
  status,
  updatedAt,
  hovered,
  setHovered,
  t,
}: CompactProps) {
  const isDone = status === 'DONE' || status === 'FAILED';
  const completionMark = status === 'DONE' ? ' ✓' : status === 'FAILED' ? ' ✕' : '';
  const isStarting = totalTokens === 0 && status === 'ACTIVE';

  return (
    <div
      className={`rounded-lg px-2.5 py-2 transition-all cursor-pointer ${isDone ? 'opacity-60' : ''}`}
      style={{
        backgroundColor: 'var(--subagent-bg)',
        border: `1px solid ${
          isDone
            ? 'var(--border-subtle)'
            : status === 'FAILED'
              ? 'var(--session-failed-border)'
              : hovered
                ? 'var(--subagent-hover-border)'
                : 'var(--subagent-border)'
        }`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isStarting ? (
        <div className="flex items-center gap-2">
          <StatusDot status={status} size="sm" />
          <span className="mono text-[13px] text-fg">{displayName}</span>
          <span className="text-[11px] animate-pulse text-fg-dim">{t('sessions.starting')}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot status={status} size="sm" />
            <span className={`mono text-[13px] font-medium truncate ${isDone ? 'text-fg-muted' : 'text-fg'}`}>
              {displayName}
              {completionMark}
            </span>
            <TagPill variant="model" size="sm">
              <span className="mono">{formatModel(model)}</span>
            </TagPill>
            {channel && (
              <TagPill variant="channel" size="sm">
                {channel}
              </TagPill>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`mono text-[12px] ${isDone ? 'text-fg-dim' : 'text-fg-muted'}`}>
              {(totalTokens / 1000).toFixed(1)}k
            </span>
            <InlineProgress percent={usagePercent} width={32} height={2} />
            <span className="text-[10px] w-12 text-right text-fg-dim">{relativeTime(updatedAt, t)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
