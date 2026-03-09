export const DEFAULT_LINE_CLAMP = 2;

export interface EventStyle {
  abbr: string;
  color: string;
  bg: string;
  border: string;
  lineClamp: number;
}

export const EVENT_TYPE_MAP: Partial<Record<string, EventStyle>> & Record<'error', EventStyle> = {
  error: { abbr: 'ERR', color: 'var(--red)', bg: 'var(--red-bg)', border: 'var(--red-border)', lineClamp: 6 },
  warning: { abbr: 'WRN', color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber-border)', lineClamp: 4 },
  gateway_restart: {
    abbr: 'RST',
    color: 'var(--orange)',
    bg: 'var(--orange-bg)',
    border: 'var(--orange-border)',
    lineClamp: 2,
  },
};

export function formatGap(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) {
    return `${m}m`;
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) {
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

export interface ProcessedEvent {
  timestamp: string;
  type: string;
  module: string;
  message: string;
  repeatCount?: number;
  repeatFirst?: string;
  gapBefore?: number;
}
