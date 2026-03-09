import React, { useLayoutEffect, useRef, useState } from 'react';

import { useI18n } from '../../i18n/context';
import { DEFAULT_LINE_CLAMP, EVENT_TYPE_MAP } from './log-types';
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
  const lineClamp = EVENT_TYPE_MAP[type]?.lineClamp ?? DEFAULT_LINE_CLAMP;
  const detailRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLSpanElement>(null);
  const [isClamped, setIsClamped] = useState(false);
  const showFade = !expanded && isClamped;

  useLayoutEffect(() => {
    if (expanded) {
      return;
    }
    const el = msgRef.current;
    if (!el) {
      return;
    }

    const measure = () => {
      const clamped = el.scrollHeight > el.clientHeight;
      setIsClamped((prev) => {
        return prev !== clamped ? clamped : prev;
      });
    };
    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [message, expanded, lineClamp]);

  return (
    <div
      ref={ref}
      id={id}
      role="listitem"
      aria-expanded={expanded}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      className="select-none"
      style={{ borderLeft: `3px solid ${style.color}` }}
    >
      {/* Compact row */}
      <div className="flex items-center gap-2 py-1 px-2 cursor-pointer" onClick={onToggle}>
        <span className="mono text-xs text-fg-muted shrink-0">{fmtTime(timestamp, locale)}</span>
        <span className="mono text-[10px] font-bold shrink-0" style={{ color: style.color }}>
          {style.abbr}
        </span>
        <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-elevated text-fg-dim border border-edge-subtle shrink-0 truncate max-w-[100px]">
          {module}
        </span>
        <div className="relative min-w-0 flex-1">
          <span
            ref={msgRef}
            data-clamp={lineClamp}
            className="mono text-xs text-fg-secondary select-text [display:-webkit-box] [-webkit-box-orient:vertical]"
            style={{
              WebkitLineClamp: lineClamp,
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {message}
          </span>
          {showFade && (
            <div
              aria-hidden
              className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none"
              style={{ background: 'linear-gradient(transparent, var(--bg-surface-solid))' }}
            />
          )}
        </div>
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
          <div className="flex justify-center mt-2">
            <button
              type="button"
              onClick={onToggle}
              className="mono text-[11px] px-3 py-1 rounded border border-edge-subtle text-fg-muted hover:text-fg-secondary hover:border-edge transition-colors"
            >
              <span aria-hidden="true">▲ </span>
              {t('logs.detail.collapse')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export const EventRow = React.memo(EventRowInner);
