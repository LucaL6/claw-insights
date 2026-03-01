import { useMemo } from 'react';

import type { BucketData } from '../../../hooks/useMetricsData';
import { useI18n } from '../../../i18n/context';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { ChartCard } from '../core/ChartCard';
import { ErrorsChart } from '../ErrorsChart';
import { getTooltips } from './metricsTooltips';
import { PreviewCard } from './PreviewCard';
import type { PreviewEvents, PreviewState } from './types';

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

export function ErrorsChartCard({
  buckets,
  totalErrors,
  rangeLabel,
  preview,
  previewEvents,
  onBucketClick,
  onClosePreview,
  navigate,
}: Props) {
  const { t } = useI18n();
  const TOOLTIPS = useMemo(() => getTooltips(t), [t]);

  return (
    <>
      <ChartCard>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-red">
              {t('metrics.errors')}
              <InfoTooltip {...TOOLTIPS.sections.errors} />
            </span>
            <span className="text-xs px-2 py-0.5 rounded mono bg-red-bg text-red border border-red-border">
              {t('metrics.errorInRange', { count: totalErrors, range: rangeLabel })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-fg-dim">
            <span>
              <span className="text-red">■</span> {t('metrics.legendError')}
            </span>
            <span>
              <span className="text-orange">■</span> {t('metrics.legendWarn')}
            </span>
            <span>
              <span className="text-amber">●</span> {t('metrics.legendRestart')}
            </span>
          </div>
        </div>
        <ErrorsChart data={buckets} onBucketClick={onBucketClick} />
      </ChartCard>
      {preview?.source === 'errors' && previewEvents && navigate && (
        <PreviewCard
          source="errors"
          title={t('charts.gatewayErrors')}
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
