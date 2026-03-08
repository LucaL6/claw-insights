import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '../../i18n/context';
import { EventRow } from './EventRow';
import { formatGap, type ProcessedEvent } from './log-types';

export type { ProcessedEvent } from './log-types';
// eslint-disable-next-line react-refresh/only-export-components -- re-exports for convenience
export { formatGap } from './log-types';

interface Props {
  events: ProcessedEvent[];
  loading?: boolean;
  error?: string;
}

function GapIndicator({
  seconds,
  t,
}: {
  seconds: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const label = formatGap(seconds);
  return (
    <div
      role="separator"
      aria-label={t('logs.gapAria', { label })}
      className="flex items-center justify-center py-1.5 px-2"
      style={{ borderTop: '1px dashed var(--border-subtle)', borderBottom: '1px dashed var(--border-subtle)' }}
    >
      <span className="mono text-[10px] text-fg-muted">{t('logs.gapSeparator', { label })}</span>
    </div>
  );
}

export function EventTable({ events, loading, error }: Props) {
  const { t } = useI18n();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [prevEvents, setPrevEvents] = useState(events);

  // Collapse when events change
  let effectiveExpandedIdx = expandedIdx;
  if (prevEvents !== events) {
    setPrevEvents(events);
    effectiveExpandedIdx = null;
    if (expandedIdx !== null) {
      setExpandedIdx(null);
    }
  }

  useEffect(() => {
    if (expandedIdx === null) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (containerRef.current?.contains(target)) {
        return;
      }
      setExpandedIdx(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [expandedIdx]);

  const handleKeyDown = useCallback(
    (idx: number) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setExpandedIdx(idx);
      } else if (e.key === 'Escape') {
        setExpandedIdx(null);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(idx + 1, events.length - 1);
        setFocusedIdx(next);
        rowRefs.current[next]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(idx - 1, 0);
        setFocusedIdx(prev);
        rowRefs.current[prev]?.focus();
      }
    },
    [events.length],
  );

  return (
    <div ref={containerRef} className="rounded-lg overflow-hidden border border-edge bg-surface">
      <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }} className="sb" role="list">
        {loading ? (
          <div className="py-8 text-center">
            <div
              className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--text-muted)' }}
            />
            <div className="text-xs mt-2 text-fg-dim">{t('logs.loading')}</div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-xs text-red">{t('logs.loadError')}</div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-xs text-fg-dim">{t('logs.noMatch')}</div>
        ) : (
          events.map((ev, i) => (
            <div key={`${ev.timestamp}-${i}`}>
              {ev.gapBefore !== undefined && <GapIndicator seconds={ev.gapBefore} t={t} />}
              <EventRow
                ref={(el: HTMLDivElement | null) => {
                  rowRefs.current[i] = el;
                }}
                id={`event-${i}`}
                timestamp={ev.timestamp}
                type={ev.type}
                module={ev.module}
                message={ev.message}
                expanded={effectiveExpandedIdx === i}
                tabIndex={focusedIdx === i ? 0 : -1}
                repeatCount={ev.repeatCount}
                repeatFirst={ev.repeatFirst}
                onToggle={() => {
                  setExpandedIdx((prev) => (prev === i ? null : i));
                }}
                onKeyDown={handleKeyDown(i)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
