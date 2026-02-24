import { useEffect,useState } from 'react';

import { useI18n } from '../../i18n/context';

interface Counts {
  error: number;
  warning: number;
  restart: number;
}

interface Props {
  activeTypes: string[];
  onToggleType: (type: string) => void;
  counts: Counts;
  total: number;
  displayed: number;
  filtered: number;
  search: string;
  onSearchChange: (s: string) => void;
  timeLabel?: string;
  onClearTimeFilter?: () => void;
}

const PILLS: Array<{ type: string; label: string; countKey: keyof Counts; color: string; bg: string; border: string }> =
  [
    {
      type: 'error',
      label: 'error',
      countKey: 'error',
      color: 'var(--red)',
      bg: 'var(--red-bg)',
      border: 'var(--red-border)',
    },
    {
      type: 'warning',
      label: 'warn',
      countKey: 'warning',
      color: 'var(--amber)',
      bg: 'var(--amber-bg)',
      border: 'var(--amber-border)',
    },
    {
      type: 'gateway_restart',
      label: 'restart',
      countKey: 'restart',
      color: 'var(--orange)',
      bg: 'var(--orange-bg)',
      border: 'var(--orange-border)',
    },
  ];

export function FilterBar({
  activeTypes,
  onToggleType,
  counts,
  total,
  displayed,
  filtered,
  search,
  onSearchChange,
  timeLabel,
  onClearTimeFilter,
}: Props) {
  const { t } = useI18n();
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => { onSearchChange(localSearch); }, 200);
    return () => { clearTimeout(timer); };
  }, [localSearch, onSearchChange]);

  return (
    <div className="mb-3 space-y-2">
      {/* Row 1: Pills + Time + Count */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Type pills */}
        <div className="flex gap-1.5">
          {PILLS.map((p) => {
            const active = activeTypes.includes(p.type);
            const empty = counts[p.countKey] === 0;
            return (
              <button
                key={p.type}
                onClick={() => { if (!empty) { onToggleType(p.type); } }}
                disabled={empty}
                className={`text-[10px] mono font-semibold px-2 py-1 rounded-md flex items-center gap-1.5 transition-all ${
                  empty
                    ? 'bg-elevated text-fg-dim border border-edge-subtle opacity-30 cursor-default'
                    : active
                      ? 'cursor-pointer'
                      : 'bg-elevated text-fg-dim border border-edge-subtle opacity-50 cursor-pointer'
                }`}
                style={
                  active && !empty
                    ? { backgroundColor: p.bg, color: p.color, border: `1px solid ${p.border}` }
                    : undefined
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-fg-dim"
                  style={active && !empty ? { backgroundColor: p.color } : undefined} // inline: dynamic runtime color
                />
                {p.label}
                {!empty && <span className="opacity-70">{counts[p.countKey]}</span>}
              </button>
            );
          })}
        </div>

        {/* Time label chip + Show All button */}
        {timeLabel && (
          <div className="flex items-center gap-2">
            <span className="mono text-[10px] px-2 py-1 rounded inline-flex items-center gap-1.5 bg-elevated text-fg-muted border border-edge-subtle">
              {timeLabel}
              {onClearTimeFilter && (
                <button
                  onClick={onClearTimeFilter}
                  className="text-[10px] leading-none cursor-pointer hover:opacity-100 opacity-50 transition-opacity text-fg-dim bg-transparent border-none p-0"
                >
                  ✕
                </button>
              )}
            </span>
            {onClearTimeFilter && (
              <button
                onClick={onClearTimeFilter}
                className="text-[10px] font-semibold px-2 py-1 rounded-md cursor-pointer transition-colors bg-sky-bg text-sky border border-sky-border"
              >
                Show All 24h
              </button>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Count */}
        <div className="flex items-center gap-1.5">
          <span className="mono text-[10px] text-fg-dim">
            {filtered}
            {search ? ` / ${displayed}` : ''} of {total}
          </span>
          {total > displayed && (
            <span className="text-[9px] text-amber opacity-70">
              (latest {displayed})
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Search */}
      <input
        type="text"
        value={localSearch}
        onChange={(e) => { setLocalSearch(e.target.value); }}
        placeholder={t('logs.filterPlaceholder')}
        className="mono text-[11px] px-3 py-1.5 rounded-md w-full bg-elevated border border-edge text-fg outline-none"
      />
    </div>
  );
}
