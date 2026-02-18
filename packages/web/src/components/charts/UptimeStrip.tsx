import { useMemo } from 'react';
import { BaseChart } from './core/BaseChart';
import { buildUptimeOption } from './builders/buildUptimeOption';

interface BucketData {
  bucket: number;
  label: string;
  gatewayUp: boolean;
  restartEvent: boolean;
}

export function UptimeStrip({ data, onCellClick }: { data: BucketData[]; onCellClick?: (index: number) => void }) {
  const option = useMemo(() => buildUptimeOption(data), [data]);

  const onEvents = useMemo(
    () =>
      onCellClick
        ? {
            click: (params: { dataIndex: number }) => {
              const d = data[params.dataIndex];
              if (d && (!d.gatewayUp || d.restartEvent)) onCellClick(params.dataIndex);
            },
          }
        : undefined,
    [onCellClick, data],
  );

  return <BaseChart option={option} height={50} testId="uptime-chart" onEvents={onEvents} />;
}
