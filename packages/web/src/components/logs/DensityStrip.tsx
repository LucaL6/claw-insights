interface DensityBucket {
  hour: number;
  count: number;
  hasError: boolean;
  hasWarning: boolean;
  hasRestart: boolean;
  epochStart: number;
}

interface Props {
  data: DensityBucket[];
  activeHour?: number;
  onHourClick?: (epochStart: number) => void;
  loading?: boolean;
}

function bucketColor(b: DensityBucket): string {
  if (b.count === 0) return 'var(--bg-elevated)';
  if (b.hasError)   return 'var(--red)';
  if (b.hasRestart) return 'var(--orange)';
  if (b.hasWarning) return 'var(--amber)';
  return 'var(--text-dim)';
}

function bucketOpacity(count: number): number {
  if (count === 0) return 0.2;
  if (count <= 5) return 0.4;
  if (count <= 20) return 0.7;
  return 1;
}

export function DensityStrip({ data, activeHour, onHourClick, loading }: Props) {
  if (loading) {
    return (
      <div className="mb-3">
        <div className="flex gap-[2px] h-6">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm animate-pulse"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="flex gap-[2px] h-6">
        {data.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm cursor-pointer transition-all relative group"
            style={{
              backgroundColor: bucketColor(b),
              opacity: bucketOpacity(b.count),
              outline: b.epochStart === activeHour ? '2px solid var(--sky)' : 'none',
              outlineOffset: 1,
            }}
            onClick={() => onHourClick?.(b.epochStart)}
            title={`${String(b.hour).padStart(2, '0')}:00 — ${b.count} events`}
          />
        ))}
      </div>
      {/* Hour labels */}
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] mono" style={{ color: 'var(--text-dim)' }}>
          {String(data[0]?.hour ?? 0).padStart(2, '0')}:00
        </span>
        <span className="text-[9px] mono" style={{ color: 'var(--text-dim)' }}>now</span>
      </div>
    </div>
  );
}
