import type { MetricsRange } from '@claw-insights/shared';

export type { MetricsRange };

export interface RangeInfo {
  label: string;
  bucketLabel: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const RANGE_INFO: Record<MetricsRange, RangeInfo> = {
  THIRTY_MIN: { label: '30m', bucketLabel: '5min' },
  ONE_HOUR: { label: '1h', bucketLabel: '5min' },
  SIX_HOUR: { label: '6h', bucketLabel: '15min' },
  TWELVE_HOUR: { label: '12h', bucketLabel: '30min' },
  TWENTY_FOUR_HOUR: { label: '24h', bucketLabel: '1h' },
};

const OPTIONS: Array<{ value: MetricsRange; label: string }> = [
  { value: 'THIRTY_MIN', label: '30m' },
  { value: 'ONE_HOUR', label: '1h' },
  { value: 'SIX_HOUR', label: '6h' },
  { value: 'TWELVE_HOUR', label: '12h' },
  { value: 'TWENTY_FOUR_HOUR', label: '24h' },
];

interface Props {
  value: MetricsRange;
  onChange: (v: MetricsRange) => void;
}

export function RangePicker({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md p-0.5 gap-px bg-elevated border border-edge">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            onChange(opt.value);
          }}
          className="mono text-xs font-medium px-2.5 py-1 rounded transition-all duration-150"
          style={
            value === opt.value
              ? {
                  color: 'var(--toggle-sort-text)',
                  backgroundColor: 'var(--toggle-sort-bg)',
                  border: '1px solid var(--toggle-sort-border)',
                  margin: '-1px',
                }
              : { color: 'var(--text-dim)', border: '1px solid transparent' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
