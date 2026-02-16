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
        className="bg-zinc-800 rounded-full overflow-hidden"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <span
          className={`block h-full ${color} rounded-full transition-all`}
          style={{ width: `${clamped}%` }}
        />
      </span>
      <span className="mono text-[10px] text-zinc-500">{clamped.toFixed(0)}%</span>
    </span>
  );
}
