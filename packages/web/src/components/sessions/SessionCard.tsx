import { useState } from 'react';

import { useI18n } from '../../i18n/context';
import { formatTokensRaw } from '../../utils/format';
import { formatModel } from '../../utils/formatModel';
import { ChevronDownIcon } from '../ui/icons';
import { BORDER_BY_STATUS } from './shared/constants';
import { InlineProgress } from './shared/InlineProgress';
import { relativeTime } from './shared/relativeTime';
import { StatusDot } from './shared/StatusDot';
import { TagPill } from './shared/TagPill';

interface Props {
  displayName: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  usagePercent: number;
  status: string;
  kind?: string;
  updatedAt: number;
  turnCount?: number;
  /** 'primary' = full session card, 'compact' = sub-agent row */
  variant?: 'primary' | 'compact';
  /** Primary only: number of sub-agents */
  subAgentCount?: number;
  /** Primary only: expand/collapse children */
  onToggle?: () => void;
  expanded?: boolean;
  hasChildren?: boolean;
  sessionKey?: string;
  onSelect?: (key: string) => void;
  selected?: boolean;
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
  turnCount,
  variant = 'primary',
  subAgentCount,
  onToggle,
  sessionKey,
  onSelect,
  selected,
  expanded,
  hasChildren,
}: Props) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);

  if (variant === 'compact') {
    return (
      <CompactCard
        {...{
          displayName,
          model,
          channel,
          totalTokens,
          usagePercent,
          status,
          updatedAt,
          turnCount,
          hovered,
          setHovered,
          t,
          sessionKey,
          onSelect,
          selected,
        }}
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
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (sessionKey) {
            onSelect?.(sessionKey);
          }
        }
      }}
      style={{
        border: `1px solid ${selected ? 'var(--violet)' : hovered ? borderInfo.hoverBorder : borderInfo.border}`,
      }}
      onClick={() => {
        if (sessionKey && onSelect) {
          onSelect(sessionKey);
        }
      }}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle?.();
              }}
              className={`flex-shrink-0 transition-transform text-fg-muted ${expanded ? '' : '-rotate-90'}`}
            >
              <ChevronDownIcon />
            </button>
          )}
          <StatusDot status={status} />
          <span className="text-[15px] font-semibold truncate text-fg">{displayName}</span>
          {kind === 'cron' && <TagPill variant="cron">{t('sessions.cron')}</TagPill>}
        </div>
        <span className="text-xs flex-shrink-0 text-fg-muted">{relativeTime(updatedAt, t)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <TagPill variant="model">
            <span className="mono">{formatModel(model)}</span>
          </TagPill>
          {channel && <TagPill variant="channel">{channel}</TagPill>}
          {kind && <TagPill variant="kind">{kind}</TagPill>}
          {subAgentCount !== undefined && subAgentCount > 0 && <TagPill variant="sub">{subAgentCount} sub</TagPill>}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="mono text-[13px] font-semibold text-fg-secondary">{formatTokensRaw(totalTokens)}</span>
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
  turnCount?: number;
  hovered: boolean;
  setHovered: (v: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  sessionKey?: string;
  onSelect?: (key: string) => void;
  selected?: boolean;
}

function CompactCard({
  displayName,
  model,
  channel,
  totalTokens,
  usagePercent,
  status,
  updatedAt,
  turnCount,
  hovered,
  setHovered,
  t,
  sessionKey,
  onSelect,
  selected,
}: CompactProps) {
  const isDone = status === 'DONE' || status === 'FAILED';
  const completionMark = status === 'DONE' ? ' ✓' : status === 'FAILED' ? ' ✕' : '';
  const hasTurnCount = typeof turnCount === 'number';
  const isStarting = status === 'ACTIVE' && hasTurnCount && turnCount === 0 && totalTokens === 0;
  const isRunning = status === 'ACTIVE' && hasTurnCount && turnCount > 0;
  const showTransientState = isStarting || (isRunning && totalTokens === 0);
  const transientLabel = isStarting ? t('sessions.starting') : t('sessions.running');

  return (
    <div
      className={`rounded-lg px-2.5 py-2 transition-all cursor-pointer ${isDone ? 'opacity-60' : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (sessionKey) {
            onSelect?.(sessionKey);
          }
        }
      }}
      style={{
        backgroundColor: 'var(--subagent-bg)',
        border: `1px solid ${
          selected
            ? 'var(--violet)'
            : isDone
              ? 'var(--border-subtle)'
              : status === 'FAILED'
                ? 'var(--session-failed-border)'
                : hovered
                  ? 'var(--subagent-hover-border)'
                  : 'var(--subagent-border)'
        }`,
      }}
      onClick={() => {
        if (sessionKey && onSelect) {
          onSelect(sessionKey);
        }
      }}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      {showTransientState ? (
        <div className="flex items-center gap-2">
          <StatusDot status={status} size="sm" />
          <span className="mono text-[13px] text-fg">{displayName}</span>
          <span className="text-xs animate-pulse text-fg-dim">{transientLabel}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <StatusDot status={status} size="sm" />
            <span className={`mono text-[13px] font-medium truncate min-w-0 ${isDone ? 'text-fg-muted' : 'text-fg'}`}>
              {displayName}
              {completionMark}
            </span>
            {isRunning && <span className="text-[11px] text-fg-dim animate-pulse">{t('sessions.running')}</span>}
            <TagPill variant="model" size="sm">
              <span className="mono">{formatModel(model)}</span>
            </TagPill>
            {channel && (
              <span className="hidden md:inline">
                <TagPill variant="channel" size="sm">
                  {channel}
                </TagPill>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className={`mono text-xs ${isDone ? 'text-fg-dim' : 'text-fg-muted'}`}>
              {formatTokensRaw(totalTokens)}
            </span>
            <InlineProgress percent={usagePercent} width={32} height={2} />
            <span className="text-xs w-12 text-right text-fg-dim hidden md:inline">{relativeTime(updatedAt, t)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
