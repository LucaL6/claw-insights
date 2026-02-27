import type { MetricsRange } from '@claw-insights/shared';
import { useEffect, useMemo, useState } from 'react';

import { useMetricsData } from '../../../hooks/useMetricsData';
import { usePreview } from '../../../hooks/usePreview';
import { useI18n } from '../../../i18n/context';
import { CollapsibleSection } from '../../layout/CollapsibleSection';
import { ChartSkeleton, Skeleton } from '../../layout/Skeleton';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { ChartCard } from '../core/ChartCard';
import { SessionsChart } from '../SessionsChart';
import { TokensChart } from '../TokensChart';
import { ErrorsChartCard } from './ErrorsChartCard';
import { RANGE_INFO, RangePicker } from './GranularityPicker';
import { MetricsSummaryRow } from './MetricsSummaryRow';
import { getTooltips } from './metricsTooltips';
import { MetricsValidationWarnings } from './MetricsValidationWarnings';
import { ModelSelector } from './ModelSelector';
import { UptimeChartCard } from './UptimeChartCard';
import { useMetricsValidation } from './useMetricsValidation';

interface MetricsSectionProps {
  range: MetricsRange;
  onRangeChange: (r: MetricsRange) => void;
  navigate?: (hash: string) => void;
  onReady?: () => void;
}

export function MetricsSection({ range, onRangeChange, navigate, onReady }: MetricsSectionProps) {
  const { t } = useI18n();
  const TOOLTIPS = useMemo(() => getTooltips(t), [t]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const {
    metrics,
    buckets,
    allModels,
    totalTokensK,
    totalErrors,
    totalWarnings,
    uptimePct,
    bucketSeconds,
    lastFetchTime,
    fetching,
    result,
  } = useMetricsData(range);

  useEffect(() => {
    if (result.data && onReady) {
      onReady();
    }
  }, [result.data, onReady]);

  const { preview, previewEvents, handleErrorClick, handleUptimeClick, closePreview } = usePreview(
    buckets,
    bucketSeconds,
  );
  const validationWarnings = useMetricsValidation(buckets);

  if (fetching) {
    return (
      <CollapsibleSection title={t('metrics.title')}>
        <div className="flex gap-4 mb-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="mt-3">
          <ChartSkeleton />
        </div>
        <div className="mt-3">
          <ChartSkeleton />
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title={t('metrics.title')}
      headerRight={<RangePicker value={range} onChange={onRangeChange} />}
      updatedAt={lastFetchTime}
    >
      {metrics && (
        <MetricsSummaryRow
          totalTokensK={totalTokensK}
          totalErrors={totalErrors}
          totalWarnings={totalWarnings}
          uptimePct={uptimePct}
        />
      )}

      <MetricsValidationWarnings warnings={validationWarnings} />

      {/* Row 1: Sessions + Tokens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard accent="sessions">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-semibold text-fg-muted">
              {t('metrics.sessions')}
              <InfoTooltip {...TOOLTIPS.sections.sessions} />
            </span>
          </div>
          <SessionsChart data={buckets} />
        </ChartCard>
        <ChartCard accent="tokens">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-fg-muted">
                {t('metrics.tokens')}
                <InfoTooltip {...TOOLTIPS.sections.tokens} />
              </span>
              <ModelSelector models={allModels} selected={selectedModel} onChange={setSelectedModel} />
            </div>
          </div>
          <TokensChart data={buckets} selectedModel={selectedModel} />
        </ChartCard>
      </div>

      {/* Row 2: Errors */}
      <div className="mt-3">
        <ErrorsChartCard
          buckets={buckets}
          totalErrors={totalErrors}
          rangeLabel={RANGE_INFO[range].label}
          preview={preview}
          previewEvents={previewEvents}
          onBucketClick={handleErrorClick}
          onClosePreview={closePreview}
          navigate={navigate}
        />
      </div>

      {/* Row 3: Uptime */}
      <div className="mt-3">
        <UptimeChartCard
          buckets={buckets}
          uptimePct={uptimePct}
          preview={preview}
          previewEvents={previewEvents}
          onCellClick={handleUptimeClick}
          onClosePreview={closePreview}
          navigate={navigate}
        />
      </div>
    </CollapsibleSection>
  );
}
