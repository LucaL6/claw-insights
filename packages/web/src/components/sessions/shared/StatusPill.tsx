export type StatusPillVariant = 'starting' | 'running' | 'idle' | 'done' | 'failed';

const PILL_STYLES: Record<StatusPillVariant, { bg: string; color: string; border: string }> = {
  starting: {
    bg: 'var(--status-pill-starting-bg)',
    color: 'var(--status-pill-starting-text)',
    border: 'var(--status-pill-starting-border)',
  },
  running: {
    bg: 'var(--status-pill-running-bg)',
    color: 'var(--status-pill-running-text)',
    border: 'var(--status-pill-running-border)',
  },
  idle: {
    bg: 'var(--status-pill-idle-bg)',
    color: 'var(--status-pill-idle-text)',
    border: 'var(--status-pill-idle-border)',
  },
  done: {
    bg: 'var(--status-pill-done-bg)',
    color: 'var(--status-pill-done-text)',
    border: 'var(--status-pill-done-border)',
  },
  failed: {
    bg: 'var(--status-pill-failed-bg)',
    color: 'var(--status-pill-failed-text)',
    border: 'var(--status-pill-failed-border)',
  },
};

interface StatusPillProps {
  variant: StatusPillVariant;
  label: string;
}

export function StatusPill({ variant, label }: StatusPillProps) {
  const s = PILL_STYLES[variant];
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 whitespace-nowrap flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {variant === 'starting' && (
        <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 1.5a6.5 6.5 0 1 1-4.6 1.9" strokeLinecap="round" />
        </svg>
      )}
      {label}
    </span>
  );
}
