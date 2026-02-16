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
    <div className="inline-flex bg-zinc-900/80 border border-zinc-800 rounded-md p-0.5 gap-px">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`
            mono text-[10px] font-medium px-2.5 py-1 rounded transition-all duration-150
            ${value === opt.value
              ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20 -m-px'
              : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30 border border-transparent'
            }
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
