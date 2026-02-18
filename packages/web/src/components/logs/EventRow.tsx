interface EventRowProps {
  timestamp: string;
  type: string;
  module: string;
  message: string;
  highlighted: boolean;
}

const LEVEL_STYLES: Record<string, { bg: string; color: string; border: string; label: string; gutter: string }> = {
  error: {
    bg: 'var(--red-bg)',
    color: 'var(--red)',
    border: 'var(--red-border)',
    label: 'ERROR',
    gutter: 'var(--red)',
  },
  warning: {
    bg: 'var(--amber-bg)',
    color: 'var(--amber)',
    border: 'var(--amber-border)',
    label: 'WARN',
    gutter: 'var(--amber)',
  },
  gateway_restart: {
    bg: 'var(--orange-bg)',
    color: 'var(--orange)',
    border: 'var(--orange-border)',
    label: 'RESTART',
    gutter: 'var(--orange)',
  },
};

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function EventRow({ timestamp, type, module, message, highlighted }: EventRowProps) {
  const style = LEVEL_STYLES[type] ?? LEVEL_STYLES.error;

  return (
    <div
      className="grid items-center py-1 px-1"
      style={{
        // inline: dynamic highlight layout
        gridTemplateColumns: '28px 82px 68px 110px 1fr',
        backgroundColor: highlighted ? style.bg : 'transparent',
        borderLeft: highlighted ? `2px solid ${style.color}` : '2px solid transparent',
      }}
    >
      {/* Gutter */}
      <div className="flex justify-center">
        <div style={{ width: 3, height: 16, borderRadius: 1, backgroundColor: style.gutter }} />
      </div>
      {/* Time */}
      <span className={`mono text-[11px] ${highlighted ? 'text-fg' : 'text-fg-muted'}`}>{fmtTime(timestamp)}</span>
      {/* Level badge */}
      <span
        className="mono text-[9px] font-semibold px-1.5 py-0.5 rounded text-center"
        style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
      >
        {style.label}
      </span>
      {/* Module pill */}
      <span
        className="mono text-[10px] px-2 py-0.5 rounded truncate text-center bg-elevated text-fg-dim border border-edge-subtle"
      >
        {module}
      </span>
      {/* Message */}
      <span className={`mono text-[11px] truncate pl-2 ${highlighted ? 'text-fg' : 'text-fg-secondary'}`}>
        {message}
      </span>
    </div>
  );
}
