import { useMemo } from 'react';
import { ChartCard } from './ChartCard';
import { ErrorsChart } from './ErrorsChart';
import { PreviewCard } from './PreviewCard';
import { InfoTooltip } from '../ui/InfoTooltip';
import { getTooltips } from './metricsTooltips';
import { useI18n } from '../../i18n/context';
import type { BucketData } from '../../hooks/useMetricsData';

interface PreviewState {
  source: 'errors' | 'uptime';
  bucketIndex: number;
  fromTs: number;
  toTs: number;
  types: string[];
}

interface PreviewEvents {
  events: Array<{ timestamp: string; type: string; module: string; message: string }>;
  total: number;
}

interface Props {
  buckets: BucketData[];
  totalErrors: number;
  rangeLabel: string;
  preview: PreviewState | null;
  previewEvents: PreviewEvents | undefined;
  onBucketClick: (idx: number) => void;
  onClosePreview: () => void;
  navigate?: (hash: string) => void;
}

export function ErrorsChartCard({ buckets, totalErrors, rangeLabel, preview, previewEvents, onBucketClick, onClosePreview, navigate }: Props) {
  const { t } = useI18n();
  const TOOLTIPS = useMemo(() => getTooltips(t), [t]);

  return (
    <>
      <ChartCard accent="errors">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-red">
              {t('metrics.errors')}
              <InfoTooltip {...TOOLTIPS.sections.errors} />
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded mono bg-red-bg text-red border border-red-border">
              {t('metrics.errorInRange', { count: totalErrors, range: rangeLabel })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-fg-dim">
            <span><span style={{color:'#ef4444'}}>■</span> {t('metrics.legendError')}</span>
            <span><span style={{color:'#f97316'}}>■</span> {t('metrics.legendWarn')}</span>
            <span><span style={{color:'#fbbf24'}}>●</span> {t('metrics.legendRestart')}</span>
          </div>
        </div>
        <ErrorsChart data={buckets} onBucketClick={onBucketClick} />
      </ChartCard>
      {preview?.source === 'errors' && previewEvents && navigate && (
        <PreviewCard
          source="errors"
          title="Gateway Errors"
          timeLabel={buckets[preview.bucketIndex]?.label ?? ''}
          events={previewEvents.events}
          total={previewEvents.total}
          linkHref={`#logs?from=${preview.fromTs}&to=${preview.toTs}&type=${preview.types.join(',')}`}
          onClose={onClosePreview}
          onNavigate={navigate}
        />
      )}
    </>
  );
}
