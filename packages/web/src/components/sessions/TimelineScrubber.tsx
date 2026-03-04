import { useMemo } from 'react';

import { useI18n } from '../../i18n/context';

interface TimeMarker {
  label: string;
  index: number;
}

interface TimelineScrubberProps {
  timestamps: string[];
  /** Currently visible message index (from scroll tracking or manual jump) */
  activeIndex?: number;
  onJump: (index: number) => void;
  /** Total message count (for jump-to-end when more messages exist beyond loaded) */
  totalMessages?: number;
  /** Called when user wants to jump to the very last message (may trigger load-all) */
  onJumpToEnd?: () => void;
  /** Whether we're currently loading to reach the end */
  isLoadingToEnd?: boolean;
}

function formatHHMM(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '--:--';
    }
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '--:--';
  }
}

function buildMarkers(timestamps: string[]): TimeMarker[] {
  if (timestamps.length === 0) {
    return [];
  }
  if (timestamps.length === 1) {
    return [{ label: formatHHMM(timestamps[0]), index: 0 }];
  }

  const maxMarkers = 8;
  const count = Math.min(maxMarkers, timestamps.length);
  const step = (timestamps.length - 1) / (count - 1);
  const markers: TimeMarker[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    const idx = Math.round(i * step);
    const label = formatHHMM(timestamps[idx]);
    if (!seen.has(label) || i === 0 || i === count - 1) {
      markers.push({ label, index: idx });
      seen.add(label);
    }
  }
  return markers;
}

/** Find the marker whose index is closest to (but ≤) the given message index */
function findNearestMarker(markers: TimeMarker[], msgIndex: number): number | undefined {
  if (markers.length === 0) {
    return undefined;
  }
  let best = markers[0].index;
  for (const m of markers) {
    if (m.index <= msgIndex) {
      best = m.index;
    } else {
      break;
    }
  }
  return best;
}

export function TimelineScrubber({
  timestamps,
  activeIndex,
  onJump,
  totalMessages,
  onJumpToEnd,
  isLoadingToEnd,
}: TimelineScrubberProps) {
  const { t } = useI18n();
  const markers = useMemo(() => buildMarkers(timestamps), [timestamps]);

  // Find which marker is "active" based on nearest match
  const activeMarkerIndex = useMemo(
    () => (activeIndex !== undefined ? findNearestMarker(markers, activeIndex) : undefined),
    [markers, activeIndex],
  );

  // Determine if we're at start/end for button states
  const isAtStart = activeIndex === 0;
  const endIndex = (totalMessages ?? timestamps.length) - 1;
  const isAtEnd = activeIndex === endIndex;

  if (markers.length < 2) {
    return null;
  }

  const jumpButtonClass = 'w-6 h-6 flex items-center justify-center rounded-md transition-colors text-[11px] shrink-0';

  return (
    <div className="flex items-center gap-1.5 py-1.5" title={t('drawer.scrubber.tooltip')}>
      {/* Jump to start button */}
      <button
        type="button"
        onClick={() => {
          onJump(0);
        }}
        disabled={isAtStart}
        className={jumpButtonClass}
        style={{
          backgroundColor: isAtStart ? 'transparent' : 'var(--dr-surface)',
          color: isAtStart ? 'var(--dr-border)' : 'var(--dr-dim)',
          border: `1px solid ${isAtStart ? 'var(--dr-border)' : 'var(--dr-border)'}`,
          cursor: isAtStart ? 'default' : 'pointer',
          opacity: isAtStart ? 0.5 : 1,
        }}
        title={t('drawer.scrubber.jumpToStart')}
        aria-label={t('drawer.scrubber.jumpToStart')}
      >
        ⏮
      </button>

      {/* Time markers */}
      <div className="flex items-center justify-between flex-1">
        {markers.map((m, i) => {
          const isActive = activeMarkerIndex === m.index;
          const isLast = i === markers.length - 1;
          return (
            <div key={i} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => {
                  onJump(m.index);
                }}
                className="font-mono text-[10px] px-1.5 py-0.5 rounded-md transition-all cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? 'var(--dr-teal)' : 'transparent',
                  color: isActive ? 'var(--dr-bg)' : 'var(--dr-dim)',
                  fontWeight: isActive ? 600 : 400,
                  boxShadow: isActive ? '0 0 6px rgba(45, 212, 191, 0.3)' : 'none',
                }}
                title={t('drawer.scrubber.jumpTo', { n: m.index + 1 })}
              >
                {m.label}
              </button>
              {!isLast && (
                <div
                  className="flex-1 h-px mx-0.5 transition-colors"
                  style={{
                    backgroundColor: isActive ? 'var(--dr-teal)' : 'var(--dr-border)',
                    opacity: isActive ? 0.4 : 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Jump to end button */}
      <button
        type="button"
        onClick={() => {
          if (onJumpToEnd) {
            onJumpToEnd();
          } else {
            onJump(endIndex);
          }
        }}
        disabled={isAtEnd || isLoadingToEnd}
        className={jumpButtonClass}
        style={{
          backgroundColor: isAtEnd || isLoadingToEnd ? 'transparent' : 'var(--dr-surface)',
          color: isAtEnd || isLoadingToEnd ? 'var(--dr-border)' : 'var(--dr-dim)',
          border: `1px solid ${isAtEnd || isLoadingToEnd ? 'var(--dr-border)' : 'var(--dr-border)'}`,
          cursor: isAtEnd || isLoadingToEnd ? 'default' : 'pointer',
          opacity: isAtEnd || isLoadingToEnd ? 0.5 : 1,
        }}
        title={t('drawer.scrubber.jumpToEnd')}
        aria-label={t('drawer.scrubber.jumpToEnd')}
      >
        {isLoadingToEnd ? '⏳' : '⏭'}
      </button>
    </div>
  );
}
