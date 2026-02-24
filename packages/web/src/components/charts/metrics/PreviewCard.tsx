import { useI18n } from '../../../i18n/context';

interface PreviewEvent {
  timestamp: string;
  type: string;
  module: string;
  message: string;
}

interface Props {
  source: 'errors' | 'uptime';
  title: string;
  timeLabel: string;
  events: PreviewEvent[];
  total: number;
  linkHref: string;
  onClose: () => void;
  onNavigate: (hash: string) => void;
}

const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  error: { bg: 'var(--red-bg)', color: 'var(--red)', border: 'var(--red-border)' },
  warning: { bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-border)' },
  gateway_restart: { bg: 'var(--orange-bg)', color: 'var(--orange)', border: 'var(--orange-border)' },
};

const TYPE_LABELS: Record<string, string> = {
  error: 'ERR',
  warning: 'WRN',
  gateway_restart: 'RST',
};

function fmtTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function PreviewCard({ source, title, timeLabel, events, total, linkHref, onClose, onNavigate }: Props) {
  const { t } = useI18n();
  const accent = source === 'errors' ? 'var(--red)' : 'var(--orange)';

  return (
    <div
      className="rounded-lg overflow-hidden mt-2 bg-surface-solid border border-edge shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-[preview-in_0.2s_ease-out]"
    >

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-edge bg-elevated"
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-fg">{title}</span>
          <span
            className="mono text-[9px] px-2 py-0.5 rounded bg-elevated border border-edge text-fg-muted"
          >
            {timeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-[11px] font-semibold" style={{ color: accent }}>
            {total}
          </span>
          <button
            onClick={onClose}
            className="text-[12px] leading-none cursor-pointer text-fg-dim bg-transparent border-none"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Event rows */}
      {events.length === 0 ? (
        <div className="px-3 py-3 text-center text-[11px] text-fg-dim">{t('logs.noEvents')}</div>
      ) : (
        events.map((ev, i) => {
          const tc = TYPE_COLORS[ev.type] ?? TYPE_COLORS.error;
          return (
            <div
              key={i}
              className="grid gap-1 px-3 py-1.5 items-center border-b border-edge-subtle"
              style={{ gridTemplateColumns: '60px 42px 1fr' }}
            >
              <span className="mono text-[10px] text-fg-muted">{fmtTime(ev.timestamp)}</span>
              <span
                className="mono text-[8px] font-semibold px-1.5 py-0.5 rounded text-center"
                style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}
              >
                {TYPE_LABELS[ev.type] ?? ev.type.slice(0, 3).toUpperCase()}
              </span>
              <span className="mono text-[10px] truncate text-fg-secondary">{ev.message || ev.module}</span>
            </div>
          );
        })
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3 py-2 border-t border-edge bg-elevated"
      >
        <button
          onClick={() => { onNavigate(linkHref); }}
          className="text-[11px] font-semibold flex items-center gap-1 cursor-pointer text-sky bg-transparent border-none"
        >
          {t('logs.viewAll')} →
        </button>
        <span className="mono text-[10px] text-fg-dim">
          {events.length} of {total}
        </span>
      </div>
    </div>
  );
}
