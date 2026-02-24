import { useMemo } from 'react';

import type { BucketData } from '../../../hooks/useMetricsData';
import { useI18n } from '../../../i18n/context';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { ChartCard } from '../core/ChartCard';
import { UptimeStrip } from '../UptimeStrip';
import { getTooltips } from './metricsTooltips';
import { PreviewCard } from './PreviewCard';
import type { PreviewEvents,PreviewState } from './types';

interface Props {
  buckets: BucketData[];
  uptimePct: number;
  preview: PreviewState | null;
  previewEvents: PreviewEvents | undefined;
  onCellClick: (idx: number) => void;
  onClosePreview: () => void;
  navigate?: (hash: string) => void;
}

export function UptimeChartCard({
  buckets,
  uptimePct,
  preview,
  previewEvents,
  onCellClick,
  onClosePreview,
  navigate,
}: Props) {
  const { t } = useI18n();
  const TOOLTIPS = useMemo(() => getTooltips(t), [t]);

  return (
    <>
      <ChartCard accent="uptime">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-fg-muted">
            {t('metrics.uptime')}
            <InfoTooltip {...TOOLTIPS.sections.uptime} />
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="mono text-[15px] font-bold text-emerald">{uptimePct.toFixed(1)}%</span>
            <InfoTooltip {...TOOLTIPS.summary.uptime} alignRight />
          </span>
        </div>
        <UptimeStrip data={buckets} onCellClick={onCellClick} />
      </ChartCard>
      {preview?.source === 'uptime' && previewEvents && navigate && (
        <PreviewCard
          source="uptime"
          title="Gateway Restart"
          timeLabel={buckets[preview.bucketIndex]?.label ?? ''}
          events={previewEvents.events}
          total={previewEvents.total}
          linkHref={`#logs?from=${preview.fromTs}&to=${preview.toTs}&type=gateway_restart`}
          onClose={onClosePreview}
          onNavigate={navigate}
        />
      )}
    </>
  );
}
