import { useEffect, useState } from 'react';

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
  search: string;
  onSearchChange: (s: string) => void;
  searchError?: boolean;
  timeLabel?: string;
  onClearTimeFilter?: () => void;
}

const PILLS: Array<{ type: string; labelKey: string; countKey: keyof Counts; color: string; bg: string; border: string }> =
  [
    {
      type: 'error',
      labelKey: 'metrics.legendError',
      countKey: 'error',
      color: 'var(--red)',
      bg: 'var(--red-bg)',
      border: 'var(--red-border)',
    },
    {
      type: 'warning',
      labelKey: 'metrics.legendWarn',
      countKey: 'warning',
      color: 'var(--amber)',
      bg: 'var(--amber-bg)',
      border: 'var(--amber-border)',
    },
    {
      type: 'gateway_restart',
      labelKey: 'metrics.legendRestart',
      countKey: 'restart',
      color: 'var(--orange)',
      bg: 'var(--orange-bg)',
      border: 'var(--orange-border)',
    },
  ];

const TYPE_LABEL_KEYS: Record<string, string> = {
  error: 'metrics.legendError',
  warning: 'metrics.legendWarn',
  gateway_restart: 'metrics.legendRestart',
};

const ALL_TYPES = ['error', 'warning', 'gateway_restart'];

export function FilterBar({
  activeTypes,
  onToggleType,
  counts,
  total,
  displayed,
  search,
  onSearchChange,
  searchError,
  timeLabel,
  onClearTimeFilter,
}: Props) {
  const { t } = useI18n();
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => { onSearchChange(localSearch); }, 200);
    return () => { clearTimeout(timer); };
  }, [localSearch, onSearchChange]);

  // Status summary
  const isAllTypes = activeTypes.length === ALL_TYPES.length || activeTypes.length === 0;
  const typeSummary = isAllTypes
    ? t('logs.typeAll')
    : activeTypes.map((tp) => t(TYPE_LABEL_KEYS[tp] ?? tp)).join('+');
  const hasSearch = search.length > 0;

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
                role="checkbox"
                aria-checked={active}
                onClick={() => { onToggleType(p.type); }}
                className={`text-xs mono font-semibold px-2 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? ''
                    : empty
                      ? 'bg-elevated text-fg-dim border border-edge-subtle opacity-30'
                      : 'bg-elevated text-fg-dim border border-edge-subtle opacity-50'
                }`}
                style={
                  active
                    ? { backgroundColor: p.bg, color: p.color, border: `1px solid ${p.border}` }
                    : undefined
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-fg-dim"
                  style={active ? { backgroundColor: p.color } : undefined}
                />
                {t(p.labelKey)}
                <span className={empty ? 'opacity-40' : 'opacity-70'}>{counts[p.countKey]}</span>
              </button>
            );
          })}
        </div>

        {/* Time label chip + Show All button */}
        {timeLabel && (
          <div className="flex items-center gap-2">
            <span className="mono text-xs px-2 py-1 rounded inline-flex items-center gap-1.5 bg-elevated text-fg-muted border border-edge-subtle">
              {timeLabel}
              {onClearTimeFilter && (
                <button
                  onClick={onClearTimeFilter}
                  className="text-xs leading-none cursor-pointer hover:opacity-100 opacity-50 transition-opacity text-fg-dim bg-transparent border-none p-0"
                >
                  ✕
                </button>
              )}
            </span>
            {onClearTimeFilter && (
              <button
                onClick={onClearTimeFilter}
                className="text-xs font-semibold px-2 py-1 rounded-md cursor-pointer transition-colors bg-sky-bg text-sky border border-sky-border"
              >
                {t('logs.showAll')}
              </button>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status summary */}
        <span className="mono text-xs text-fg-dim">
          {timeLabel ?? t('logs.last24h')} · {typeSummary} · {hasSearch ? t('logs.eventsFilteredCount', { displayed, total }) : t('logs.eventsCount', { count: displayed })}
        </span>
      </div>

      {/* Row 2: Search */}
      <div className="relative">
        <input
          type="text"
          value={localSearch}
          onChange={(e) => { setLocalSearch(e.target.value); }}
          placeholder={t('logs.filterPlaceholder')}
          className={`mono text-xs px-3 py-1.5 rounded-md w-full bg-elevated border text-fg outline-none ${
            searchError ? 'border-red' : 'border-edge'
          }`}
        />
        {searchError && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red">
            ⚠ {t('logs.invalidRegex')}
          </span>
        )}
      </div>
    </div>
  );
}
