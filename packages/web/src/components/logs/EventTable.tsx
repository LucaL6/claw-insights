import { EventRow } from './EventRow';

interface Event {
  timestamp: string;
  type: string;
  module: string;
  message: string;
}

interface Props {
  events: Event[];
  highlightFrom?: number;
  highlightTo?: number;
  search: string;
  loading?: boolean;
  error?: string;
}

export function EventTable({ events, highlightFrom, highlightTo, search, loading, error }: Props) {
  const filtered = search
    ? events.filter(
        (e) =>
          e.message.toLowerCase().includes(search.toLowerCase()) ||
          e.module.toLowerCase().includes(search.toLowerCase()),
      )
    : events;

  const isHighlighted = (ev: Event): boolean => {
    if (highlightFrom === undefined || highlightTo === undefined) {return false;}
    const epoch = Math.floor(new Date(ev.timestamp).getTime() / 1000);
    return epoch >= highlightFrom && epoch < highlightTo;
  };

  return (
    <div
      className="rounded-lg overflow-hidden border border-edge bg-surface"
    >
      {/* Header */}
      <div
        className="grid items-center py-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide"
        style={{
          gridTemplateColumns: '28px 82px 68px 110px 1fr',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)',
          color: 'var(--text-dim)',
        }}
      >
        <span />
        <span>Time</span>
        <span>Level</span>
        <span>Module</span>
        <span className="pl-2">Message</span>
      </div>
      {/* Body */}
      <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }} className="sb">
        {loading ? (
          <div className="py-8 text-center">
            <div
              className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--text-muted)' }}
            />
            <div className="text-[11px] mt-2 text-fg-dim">Loading events...</div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-[11px] text-red">Failed to load events</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-fg-dim">No events match filters</div>
        ) : (
          filtered.map((ev, i) => (
            <EventRow
              key={`${ev.timestamp}-${i}`}
              timestamp={ev.timestamp}
              type={ev.type}
              module={ev.module}
              message={ev.message}
              highlighted={isHighlighted(ev)}
            />
          ))
        )}
      </div>
    </div>
  );
}
