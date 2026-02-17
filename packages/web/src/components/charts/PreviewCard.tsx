import { useI18n } from '../../i18n/context';

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
  error: 'ERR', warning: 'WRN', gateway_restart: 'RST',
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
      className="rounded-lg overflow-hidden mt-2"
      style={{
        backgroundColor: 'var(--bg-surface-solid)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animation: 'preview-in 0.2s ease-out',
      }}
    >
      <style>{`@keyframes preview-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-fg">{title}</span>
          <span className="mono text-[9px] px-2 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {timeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-[11px] font-semibold" style={{ color: accent }}>{total}</span>
          <button onClick={onClose} className="text-[12px] leading-none cursor-pointer" style={{ color: 'var(--text-dim)', background: 'none', border: 'none' }}>✕</button>
        </div>
      </div>

      {/* Event rows */}
      {events.length === 0 ? (
        <div className="px-3 py-3 text-center text-[11px] text-fg-dim">{t('logs.noEvents')}</div>
      ) : events.map((ev, i) => {
        const tc = TYPE_COLORS[ev.type] ?? TYPE_COLORS.error;
        return (
          <div key={i} className="grid gap-1 px-3 py-1.5 items-center" style={{ gridTemplateColumns: '60px 42px 1fr', borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="mono text-[10px] text-fg-muted">{fmtTime(ev.timestamp)}</span>
            <span className="mono text-[8px] font-semibold px-1.5 py-0.5 rounded text-center" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
              {TYPE_LABELS[ev.type] ?? ev.type.slice(0, 3).toUpperCase()}
            </span>
            <span className="mono text-[10px] truncate text-fg-secondary">{ev.message || ev.module}</span>
          </div>
        );
      })}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        <button
          onClick={() => onNavigate(linkHref)}
          className="text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
          style={{ color: 'var(--sky)', background: 'none', border: 'none' }}
        >
          {t('logs.viewAll')} →
        </button>
        <span className="mono text-[10px] text-fg-dim">{events.length} of {total}</span>
      </div>
    </div>
  );
}
