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

export function TimelineScrubber({ timestamps, activeIndex, onJump }: TimelineScrubberProps) {
  const { t } = useI18n();
  const markers = useMemo(() => buildMarkers(timestamps), [timestamps]);

  // Find which marker is "active" based on nearest match
  const activeMarkerIndex = useMemo(
    () => (activeIndex !== undefined ? findNearestMarker(markers, activeIndex) : undefined),
    [markers, activeIndex],
  );

  if (markers.length < 2) {
    return null;
  }

  return (
    <div className="flex items-center justify-between py-1.5" title={t('drawer.scrubber.tooltip')}>
      {markers.map((m, i) => {
        const isActive = activeMarkerIndex === m.index;
        const isFirst = i === 0;
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
              {isFirst ? '◁ ' : ''}
              {m.label}
              {isLast ? ' ▷' : ''}
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
  );
}
