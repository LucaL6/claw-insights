// Note: These use CSS variables so they work in both themes.
// We use inline style objects since Tailwind classes can't reference CSS vars dynamically.

export const STATUS_DOT: Record<string, { bg: string; shadow?: string }> = {
  ACTIVE: { bg: 'var(--status-active)', shadow: '0 0 6px var(--status-active-shadow)' },
  IDLE: { bg: 'var(--status-idle)' },
  DONE: { bg: 'var(--status-done)' },
  FAILED: { bg: 'var(--status-failed)' },
};

export const TAG_STYLES = {
  model: { bg: 'var(--tag-model-bg)', color: 'var(--tag-model-text)', border: 'var(--tag-model-border)' },
  channel: { bg: 'var(--tag-channel-bg)', color: 'var(--tag-channel-text)', border: 'var(--tag-channel-border)' },
  kind: { bg: 'var(--tag-kind-bg)', color: 'var(--tag-kind-text)', border: 'var(--tag-kind-border)' },
  sub: { bg: 'var(--tag-sub-bg)', color: 'var(--tag-sub-text)', border: 'var(--tag-sub-border)' },
  cron: { bg: 'var(--tag-cron-bg)', color: 'var(--tag-cron-text)', border: 'var(--tag-cron-border)' },
} as const;

export type TagVariant = keyof typeof TAG_STYLES;

export function getProgressColor(percent: number): string {
  if (percent >= 80) return 'var(--red)';
  if (percent >= 50) return 'var(--amber)';
  return 'var(--emerald)';
}

export const BORDER_BY_STATUS: Record<string, { border: string; hoverBorder: string }> = {
  ACTIVE: { border: 'var(--session-active-border)', hoverBorder: 'var(--session-active-border-hover)' },
  ACTIVE_WARN: { border: 'var(--session-warn-border)', hoverBorder: 'var(--session-warn-border-hover)' },
  IDLE: { border: 'var(--session-idle-border)', hoverBorder: 'var(--session-idle-border-hover)' },
  DONE: { border: 'var(--session-idle-border)', hoverBorder: 'var(--session-idle-border-hover)' },
  FAILED: { border: 'var(--session-failed-border)', hoverBorder: 'var(--session-failed-border-hover)' },
};
