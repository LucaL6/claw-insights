import { useMemo } from 'react';

import { useI18n } from '../../i18n/context';
import { buildUptimeOption } from './builders/buildUptimeOption';
import { BaseChart } from './core/BaseChart';

interface BucketData {
  bucket: number;
  label: string;
  gatewayUp: boolean;
  restartEvent: boolean;
}

export function UptimeStrip({ data, onCellClick }: { data: BucketData[]; onCellClick?: (index: number) => void }) {
  const { t } = useI18n();
  const chartLabels = useMemo(() => ({ up: t('charts.up'), down: t('charts.down'), restart: t('charts.restart') }), [t]);
  const option = useMemo(() => buildUptimeOption(data, chartLabels), [data, chartLabels]);

  const onEvents = useMemo(
    () =>
      onCellClick
        ? {
            click: (params: { dataIndex: number }) => {
              const d = data[params.dataIndex];
              if (!d.gatewayUp || d.restartEvent) {onCellClick(params.dataIndex);}
            },
          }
        : undefined,
    [onCellClick, data],
  );

  return <BaseChart option={option} height={50} testId="uptime-chart" onEvents={onEvents} />;
}
