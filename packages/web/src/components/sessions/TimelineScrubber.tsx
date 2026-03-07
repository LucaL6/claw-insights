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
const MAX_MARKERS = 8;
const MINUTES_PER_MARKER = 30;

interface MarkerCandidate {
  label: string;
  index: number;
  ms: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseTimestampMs(iso: string, fallback: number): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? fallback : ms;
}

function dedupeByMinuteKeepEarliest(timestamps: string[]): MarkerCandidate[] {
  const buckets = new Map<string, MarkerCandidate>();

  for (let i = 0; i < timestamps.length; i += 1) {
    const label = formatHHMM(timestamps[i]);
    if (buckets.has(label)) {
      continue;
    }
    buckets.set(label, {
      label,
      index: i,
      ms: parseTimestampMs(timestamps[i], i),
    });
  }

  return [...buckets.values()].sort((a, b) => a.index - b.index);
}

function targetMarkerCount(candidates: MarkerCandidate[]): number {
  const uniqueCount = candidates.length;
  if (uniqueCount <= 1) {
    return uniqueCount;
  }
  if (uniqueCount <= MAX_MARKERS) {
    return uniqueCount;
  }

  const firstMs = candidates[0].ms;
  const lastMs = candidates[uniqueCount - 1].ms;
  const spanMinutes = Math.max((lastMs - firstMs) / 60_000, 0);

  const byTime = Math.max(2, Math.ceil(spanMinutes / MINUTES_PER_MARKER) + 2);
  const byCount = Math.max(2, Math.ceil(Math.sqrt(uniqueCount)));
  const blended = Math.round((byTime + byCount) / 2);

  return clamp(blended, MIN_MARKERS, MAX_MARKERS);
}

function dynamicMinGap(rawCount: number, targetCount: number): number {
  if (rawCount <= 1 || targetCount <= 1) {
    return 1;
  }
  const avgGap = (rawCount - 1) / (targetCount - 1);
  return Math.max(1, Math.floor(avgGap * 0.5));
}

function canSelectCandidate(
  candidatePos: number,
  candidates: MarkerCandidate[],
  selected: Set<number>,
  minGap: number,
): boolean {
  const candidateIndex = candidates[candidatePos].index;
  for (const selectedPos of selected) {
    if (Math.abs(candidates[selectedPos].index - candidateIndex) < minGap) {
      return false;
    }
  }
  return true;
}

function pickNearestCandidate(
  candidates: MarkerCandidate[],
  selected: Set<number>,
  minGap: number,
  score: (candidate: MarkerCandidate) => number,
): number | undefined {
  let bestPos: number | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let pos = 0; pos < candidates.length; pos += 1) {
    if (selected.has(pos)) {
      continue;
    }
    if (!canSelectCandidate(pos, candidates, selected, minGap)) {
      continue;
    }

    const scoreValue = score(candidates[pos]);
    if (scoreValue < bestScore) {
      bestScore = scoreValue;
      bestPos = pos;
    }
  }

  return bestPos;
}

function fillByTimeAnchors(
  candidates: MarkerCandidate[],
  selected: Set<number>,
  targetCount: number,
  minGap: number,
): void {
  if (targetCount <= 2) {
    return;
  }

  const firstMs = candidates[0].ms;
  const lastMs = candidates[candidates.length - 1].ms;
  const span = Math.max(lastMs - firstMs, 0);
  if (span === 0) {
    return;
  }

  for (let i = 1; i < targetCount - 1 && selected.size < targetCount; i += 1) {
    const targetMs = firstMs + (span * i) / (targetCount - 1);
    const pos = pickNearestCandidate(candidates, selected, minGap, (candidate) => {
      const timeDelta = Math.abs(candidate.ms - targetMs);
      return timeDelta + candidate.index / 1_000_000;
    });
    if (pos !== undefined) {
      selected.add(pos);
    }
  }
}

function fillByMessageAnchors(
  candidates: MarkerCandidate[],
  selected: Set<number>,
  targetCount: number,
  rawMessageCount: number,
  minGap: number,
): void {
  if (targetCount <= 2) {
    return;
  }

  const lastRawIndex = rawMessageCount - 1;
  for (let i = 1; i < targetCount - 1 && selected.size < targetCount; i += 1) {
    const targetRawIndex = Math.round((lastRawIndex * i) / (targetCount - 1));
    const pos = pickNearestCandidate(candidates, selected, minGap, (candidate) => {
      const msgDelta = Math.abs(candidate.index - targetRawIndex);
      return msgDelta + candidate.index / 1_000_000;
    });
    if (pos !== undefined) {
      selected.add(pos);
    }
  }
}

function backfillCandidates(
  candidates: MarkerCandidate[],
  selected: Set<number>,
  targetCount: number,
  minGap: number,
): void {
  for (let gap = Math.max(1, minGap - 1); gap >= 1 && selected.size < targetCount; gap -= 1) {
    for (let pos = 1; pos < candidates.length - 1 && selected.size < targetCount; pos += 1) {
      if (selected.has(pos)) {
        continue;
      }
      if (canSelectCandidate(pos, candidates, selected, gap)) {
        selected.add(pos);
      }
    }
  }

  for (let pos = 1; pos < candidates.length - 1 && selected.size < targetCount; pos += 1) {
    if (!selected.has(pos)) {
      selected.add(pos);
    }
  }
}

function buildMarkers(timestamps: string[]): TimeMarker[] {
  if (timestamps.length === 0) {
    return [];
  }

  const deduped = dedupeByMinuteKeepEarliest(timestamps);
  const candidates =
    deduped.length >= 2
      ? deduped
      : timestamps.length >= 2
        ? [
            {
              label: formatHHMM(timestamps[0]),
              index: 0,
              ms: parseTimestampMs(timestamps[0], 0),
            },
            {
              label: formatHHMM(timestamps[timestamps.length - 1]),
              index: timestamps.length - 1,
              ms: parseTimestampMs(timestamps[timestamps.length - 1], timestamps.length - 1),
            },
          ]
        : deduped;

  if (candidates.length === 0) {
    return [];
  }
  if (candidates.length === 1) {
    return [{ label: candidates[0].label, index: candidates[0].index }];
  }

  const targetCount = Math.min(targetMarkerCount(candidates), candidates.length);
  const selected = new Set<number>([0, candidates.length - 1]);

  if (targetCount > 2) {
    const minGap = dynamicMinGap(timestamps.length, targetCount);
    fillByTimeAnchors(candidates, selected, targetCount, minGap);
    fillByMessageAnchors(candidates, selected, targetCount, timestamps.length, minGap);
    backfillCandidates(candidates, selected, targetCount, minGap);
  }

  return [...selected]
    .sort((a, b) => candidates[a].index - candidates[b].index)
    .map((pos) => ({
      label: candidates[pos].label,
      index: candidates[pos].index,
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
