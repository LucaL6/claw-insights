import { useI18n } from '../../i18n/context';

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Pick singular or plural i18n key based on count */
function tp(t: TFn, singular: string, plural: string, count: number): string {
  return t(count === 1 ? singular : plural, { count });
}

interface DensityBucket {
  hour: number;
  count: number;
  hasError: boolean;
  hasWarning: boolean;
  hasRestart: boolean;
  errorCount: number;
  warningCount: number;
  restartCount: number;
  epochStart: number;
}

interface Props {
  data: DensityBucket[];
  activeHour?: number;
  onHourClick?: (epochStart: number) => void;
  loading?: boolean;
}

function bucketColor(b: DensityBucket): string {
  if (b.count === 0) {return 'var(--bg-elevated)';}
  if (b.hasError) {return 'var(--red)';}
  if (b.hasRestart) {return 'var(--orange)';}
  if (b.hasWarning) {return 'var(--amber)';}
  return 'var(--text-dim)';
}

function bucketOpacity(count: number): number {
  if (count === 0) {return 0.2;}
  if (count <= 5) {return 0.4;}
  if (count <= 20) {return 0.7;}
  return 1;
}

function buildAriaLabel(b: DensityBucket, t: TFn): string {
  const hour = String(b.hour).padStart(2, '0');
  let label = t('logs.density.ariaLabel', { hour, events: tp(t, 'logs.density.event', 'logs.density.events', b.count) });
  if (b.errorCount > 0) label += `, ${tp(t, 'logs.density.error', 'logs.density.errors', b.errorCount)}`;
  if (b.warningCount > 0) label += `, ${tp(t, 'logs.density.warning', 'logs.density.warnings', b.warningCount)}`;
  if (b.restartCount > 0) label += `, ${tp(t, 'logs.density.restart', 'logs.density.restarts', b.restartCount)}`;
  return label;
}

function BucketTooltip({ bucket, t }: { bucket: DensityBucket; t: TFn }) {
  const hour = String(bucket.hour).padStart(2, '0');
  return (
    <div
      className="density-tooltip mono"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 4,
        padding: '4px 8px',
        background: 'var(--bg-surface-solid)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        whiteSpace: 'nowrap',
        opacity: 0,
        pointerEvents: 'none',
        transition: 'opacity 0.15s',
        zIndex: 10,
      }}
    >
      <div className="text-fg text-[11px] font-medium">{hour}:00</div>
      {bucket.errorCount > 0 && (
        <div style={{ color: 'var(--red)' }} className="text-[10px]">
          {tp(t, 'logs.density.error', 'logs.density.errors', bucket.errorCount)}
        </div>
      )}
      {bucket.warningCount > 0 && (
        <div style={{ color: 'var(--amber)' }} className="text-[10px]">
          {tp(t, 'logs.density.warning', 'logs.density.warnings', bucket.warningCount)}
        </div>
      )}
      {bucket.restartCount > 0 && (
        <div style={{ color: 'var(--orange)' }} className="text-[10px]">
          {tp(t, 'logs.density.restart', 'logs.density.restarts', bucket.restartCount)}
        </div>
      )}
      <div className="text-fg-muted text-[10px]">{tp(t, 'logs.density.event', 'logs.density.events', bucket.count)}</div>
    </div>
  );
}

const tooltipCss = `
.density-bar:hover .density-tooltip {
  opacity: 1 !important;
}
`;

export function DensityStrip({ data, activeHour, onHourClick, loading }: Props) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="mb-3">
        <div className="flex gap-[2px] h-6">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="flex-1 rounded-sm animate-pulse bg-elevated" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <style>{tooltipCss}</style>
      <div className="flex gap-[2px] h-6">
        {data.map((b, i) => (
          <div
            key={i}
            className="density-bar flex-1 rounded-sm cursor-pointer transition-all relative group"
            role="img"
            aria-label={buildAriaLabel(b, t)}
            style={{
              backgroundColor: bucketColor(b),
              opacity: bucketOpacity(b.count),
              outline: b.epochStart === activeHour ? '2px solid var(--sky)' : 'none',
              outlineOffset: 1,
            }}
            onClick={() => onHourClick?.(b.epochStart)}
          >
            <BucketTooltip bucket={b} t={t} />
          </div>
        ))}
      </div>
      {/* Hour labels */}
      <div className="flex justify-between mt-0.5">
        <span className="text-xs mono text-fg-dim">{String(data[0]?.hour ?? 0).padStart(2, '0')}:00</span>
        <span className="text-xs mono text-fg-dim">{t('logs.density.now')}</span>
      </div>
    </div>
  );
}
