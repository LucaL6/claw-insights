export type MetricsRange = 'ONE_HOUR' | 'SIX_HOUR' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

export interface RangeInfo {
  label: string;
  bucketLabel: string;
}

export const RANGE_INFO: Record<MetricsRange, RangeInfo> = {
  ONE_HOUR:         { label: '1h',  bucketLabel: '5min' },
  SIX_HOUR:         { label: '6h',  bucketLabel: '15min' },
  TWELVE_HOUR:      { label: '12h', bucketLabel: '30min' },
  TWENTY_FOUR_HOUR: { label: '24h', bucketLabel: '1h' },
};

const OPTIONS: Array<{ value: MetricsRange; label: string }> = [
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
    <div
      className="inline-flex rounded-md p-0.5 gap-px"
      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="mono text-[10px] font-medium px-2.5 py-1 rounded transition-all duration-150"
          style={value === opt.value
            ? { color: 'var(--toggle-sort-text)', backgroundColor: 'var(--toggle-sort-bg)', border: '1px solid var(--toggle-sort-border)', margin: '-1px' }
            : { color: 'var(--text-dim)', border: '1px solid transparent' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
