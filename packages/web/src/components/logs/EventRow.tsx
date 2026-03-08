import React, { useRef } from 'react';

import { useI18n } from '../../i18n/context';
import { EVENT_TYPE_MAP } from './log-types';
export type { ProcessedEvent } from './log-types';

interface EventRowProps {
  id: string;
  timestamp: string;
  type: string;
  module: string;
  message: string;
  expanded: boolean;
  tabIndex: number;
  repeatCount?: number;
  repeatFirst?: string;
  onToggle: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function fmtTime(ts: string, locale: string): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    return time;
  }
  const date = d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return `${date} ${time}`;
}

const EventRowInner = React.forwardRef<HTMLDivElement, EventRowProps>(function EventRowInner(
  { id, timestamp, type, module, message, expanded, tabIndex, repeatCount, repeatFirst, onToggle, onKeyDown },
  ref,
) {
  const { t, lang } = useI18n();
  const locale = lang === 'zh' ? 'zh-CN' : 'en-GB';
  const style = EVENT_TYPE_MAP[type] ?? EVENT_TYPE_MAP.error;
  const detailRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      id={id}
      role="listitem"
      aria-expanded={expanded}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      className={`select-none ${expanded ? 'cursor-default' : 'cursor-pointer'}`}
      style={{ borderLeft: `3px solid ${style.color}` }}
    >
      {/* Compact row */}
      <div className="flex items-center gap-2 py-1 px-2" onClick={expanded ? undefined : onToggle}>
        <span className="mono text-xs text-fg-muted shrink-0">{fmtTime(timestamp, locale)}</span>
        <span className="mono text-[10px] font-bold shrink-0" style={{ color: style.color }}>
          {style.abbr}
        </span>
        <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-elevated text-fg-dim border border-edge-subtle shrink-0 truncate max-w-[100px]">
          {module}
        </span>
        <span
          className="mono text-xs text-fg-secondary min-w-0 select-text [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
          style={{
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {message}
        </span>
        {repeatCount && repeatCount >= 2 && (
          <span className="mono text-[10px] text-fg-muted shrink-0">×{repeatCount}</span>
        )}
      </div>

      {/* Expandable detail panel */}
      {expanded && (
        <div
          ref={(el) => {
            detailRef.current = el;
            if (el) {
              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }}
          role="region"
          aria-labelledby={id}
          className="px-4 py-2 bg-elevated border-t border-edge-subtle"
          style={{
            animation: 'expand 150ms ease-out',
          }}
        >
          <pre className="mono text-xs text-fg whitespace-pre-wrap break-words m-0 leading-[1.55] tracking-[0.01em] font-medium [font-variant-ligatures:none] select-text">
            {message}
          </pre>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-fg-muted mono">
            <span>{t('logs.detail.module', { name: module })}</span>
            <span>{t('logs.detail.time', { time: fmtTime(timestamp, locale) })}</span>
            {repeatCount && repeatCount >= 2 && repeatFirst && (
              <span>
                {t('logs.detail.repeat', {
                  count: repeatCount,
                  from: fmtTime(repeatFirst, locale),
                  to: fmtTime(timestamp, locale),
                })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export const EventRow = React.memo(EventRowInner);
