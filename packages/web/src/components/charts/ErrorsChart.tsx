import { useMemo } from 'react';
import { BaseChart } from './core/BaseChart';
import { buildErrorsOption } from './builders/buildErrorsOption';
import { getTooltips } from './metrics/metricsTooltips';
import { useI18n } from '../../i18n/context';

interface BucketData {
  bucket: number;
  label: string;
  errors: number;
  warnings: number;
  restartEvent: boolean;
}

export function ErrorsChart({ data, onBucketClick }: { data: BucketData[]; onBucketClick?: (index: number) => void }) {
  const { t } = useI18n();
  const footer = useMemo(() => getTooltips(t).chartFooter.errors, [t]);
  const option = useMemo(() => buildErrorsOption(data, footer), [data, footer]);

  const onEvents = useMemo(
    () =>
      onBucketClick
        ? {
            click: (params: { dataIndex: number; seriesName: string }) => {
              if (params.seriesName !== 'Restart') onBucketClick(params.dataIndex);
            },
          }
        : undefined,
    [onBucketClick],
  );

  return <BaseChart option={option} height={80} testId="errors-chart" onEvents={onEvents} />;
}
