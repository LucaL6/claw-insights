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
  /** Total message count (for jump-to-start/end when more messages exist beyond loaded) */
  totalMessages?: number;
  /** Whether there are older messages before the loaded window */
  hasPreviousPage?: boolean;
  /** Called when user wants to jump to the very first message (may trigger load-all) */
  onJumpToStart?: () => void;
  /** Called when user wants to jump to the very last message (may trigger load-all) */
  onJumpToEnd?: () => void;
  /** Whether we're currently loading to reach the start */
  isLoadingToStart?: boolean;
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

const MIN_MARKERS = 4;
const MAX_MARKERS = 12;
const MINUTES_PER_MARKER = 10;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseTimestampMs(iso: string, fallback: number): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? fallback : ms;
}

function targetMarkerCount(timestamps: string[]): number {
  const messageCount = timestamps.length;
  if (messageCount <= 1) {
    return messageCount;
  }
  if (messageCount <= MAX_MARKERS) {
    return messageCount;
  }

  const firstMs = parseTimestampMs(timestamps[0], 0);
  const lastMs = parseTimestampMs(timestamps[messageCount - 1], messageCount - 1);
  const spanMinutes = Math.max((lastMs - firstMs) / 60_000, 0);

  const byTime = Math.max(2, Math.ceil(spanMinutes / MINUTES_PER_MARKER) + 1);
  const byCount = Math.ceil(Math.sqrt(messageCount) * 2);
  const blended = Math.round((byTime + byCount) / 2);

  return clamp(Math.min(blended, messageCount), MIN_MARKERS, MAX_MARKERS);
}

function nearestUnselectedByTime(targetMs: number, timeMs: number[], selected: Set<number>): number | undefined {
  let bestIndex: number | undefined;
  let bestDist = Infinity;

  for (let i = 0; i < timeMs.length; i += 1) {
    if (selected.has(i)) {
      continue;
    }
    const dist = Math.abs(timeMs[i] - targetMs);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function nearestUnselectedByIndex(targetIndex: number, total: number, selected: Set<number>): number | undefined {
  if (!selected.has(targetIndex) && targetIndex >= 0 && targetIndex < total) {
    return targetIndex;
  }

  for (let offset = 1; offset < total; offset += 1) {
    const left = targetIndex - offset;
    const right = targetIndex + offset;
    if (left >= 0 && !selected.has(left)) {
      return left;
    }
    if (right < total && !selected.has(right)) {
      return right;
    }
  }

  return undefined;
}

function buildMarkers(timestamps: string[]): TimeMarker[] {
  if (timestamps.length === 0) {
    return [];
  }
  if (timestamps.length === 1) {
    return [{ label: formatHHMM(timestamps[0]), index: 0 }];
  }

  const count = targetMarkerCount(timestamps);
  const total = timestamps.length;
  const lastIndex = total - 1;

  const timeMs = timestamps.map((iso, index) => parseTimestampMs(iso, index));
  const firstMs = timeMs[0];
  const lastMs = timeMs[lastIndex];

  const selected = new Set<number>([0, lastIndex]);

  if (count > 2) {
    const span = Math.max(lastMs - firstMs, 0);
    if (span > 0) {
      for (let i = 1; i < count - 1; i += 1) {
        const targetMs = firstMs + (span * i) / (count - 1);
        const nextIndex = nearestUnselectedByTime(targetMs, timeMs, selected);
        if (nextIndex !== undefined) {
          selected.add(nextIndex);
        }
      }
    }

    for (let i = 1; selected.size < count && i < count - 1; i += 1) {
      const targetIndex = Math.round((lastIndex * i) / (count - 1));
      const nextIndex = nearestUnselectedByIndex(targetIndex, total, selected);
      if (nextIndex !== undefined) {
        selected.add(nextIndex);
      }
    }
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map((index) => ({
      label: formatHHMM(timestamps[index]),
      index,
    }));
}

/** Find the marker whose index is closest to the given message index. */
function findNearestMarker(markers: TimeMarker[], msgIndex: number): number | undefined {
  if (markers.length === 0) {
    return undefined;
  }

  let best = markers[0].index;
  let bestDist = Math.abs(best - msgIndex);

  for (let i = 1; i < markers.length; i += 1) {
    const index = markers[i].index;
    const dist = Math.abs(index - msgIndex);
    if (dist < bestDist || (dist === bestDist && index > best)) {
      best = index;
      bestDist = dist;
    }
  }

  return best;
}

export function TimelineScrubber({
  timestamps,
  activeIndex,
  onJump,
  totalMessages,
  hasPreviousPage,
  onJumpToStart,
  onJumpToEnd,
  isLoadingToStart,
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
  // Start should only be considered "at start" when there are no unloaded older messages.
  const isAtStart = activeIndex === 0 && !hasPreviousPage;
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
          if (onJumpToStart) {
            onJumpToStart();
          } else {
            onJump(0);
          }
        }}
        disabled={isAtStart || isLoadingToStart}
        className={jumpButtonClass}
        style={{
          backgroundColor: isAtStart || isLoadingToStart ? 'transparent' : 'var(--dr-surface)',
          color: isAtStart || isLoadingToStart ? 'var(--dr-border)' : 'var(--dr-dim)',
          border: `1px solid ${isAtStart || isLoadingToStart ? 'var(--dr-border)' : 'var(--dr-border)'}`,
          cursor: isAtStart || isLoadingToStart ? 'default' : 'pointer',
          opacity: isAtStart || isLoadingToStart ? 0.5 : 1,
        }}
        title={t('drawer.scrubber.jumpToStart')}
        aria-label={t('drawer.scrubber.jumpToStart')}
      >
        {isLoadingToStart ? '⏳' : '⏮'}
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
