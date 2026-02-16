export const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]',
  IDLE: 'bg-zinc-500',
  DONE: 'bg-blue-500',
  FAILED: 'bg-red-500',
};

export const TAG_STYLES = {
  model: 'bg-sky-500/8 text-sky-400/80 border-sky-500/12',
  channel: 'bg-violet-500/8 text-violet-400/80 border-violet-500/12',
  kind: 'bg-zinc-500/8 text-zinc-400 border-zinc-500/12',
  sub: 'bg-emerald-500/8 text-emerald-400/70 border-emerald-500/12',
  cron: 'bg-violet-500/15 text-violet-400 border-violet-500/20 font-semibold',
} as const;

export type TagVariant = keyof typeof TAG_STYLES;

export const PROGRESS_COLORS = {
  low: 'bg-emerald-500/60',
  mid: 'bg-amber-500/60',
  high: 'bg-red-500/60',
} as const;

export function getProgressColor(percent: number): string {
  if (percent >= 80) return PROGRESS_COLORS.high;
  if (percent >= 50) return PROGRESS_COLORS.mid;
  return PROGRESS_COLORS.low;
}

export const BORDER_BY_STATUS: Record<string, string> = {
  ACTIVE: 'border-emerald-500/20 hover:border-emerald-500/30',
  ACTIVE_WARN: 'border-orange-500/20 hover:border-orange-500/30',
  IDLE: 'border-zinc-800/60 hover:border-zinc-700',
  DONE: 'border-zinc-800/60 hover:border-zinc-700',
  FAILED: 'border-red-500/15 hover:border-red-500/25',
};
