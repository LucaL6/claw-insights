import { getProgressColor } from './constants';

interface InlineProgressProps {
  percent: number;
  width?: number;
  height?: number;
}

export function InlineProgress({ percent, width = 40, height = 3 }: InlineProgressProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const color = getProgressColor(clamped);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="rounded-full overflow-hidden"
        style={{ width: `${width}px`, height: `${height}px`, backgroundColor: 'var(--progress-track)' }}
      >
        <span
          className="block h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </span>
      <span className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{clamped.toFixed(0)}%</span>
    </span>
  );
}
