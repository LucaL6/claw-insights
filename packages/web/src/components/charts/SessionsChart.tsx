import { useMemo } from 'react';
import { BaseChart } from './core/BaseChart';
import { buildSessionsOption } from './builders/buildSessionsOption';
import { getTooltips } from './metrics/metricsTooltips';
import { useI18n } from '../../i18n/context';

interface BucketData {
  bucket: number;
  label: string;
  sessions: number;
}

export function SessionsChart({ data }: { data: BucketData[] }) {
  const { t } = useI18n();
  const footer = useMemo(() => getTooltips(t).chartFooter.sessions, [t]);
  const option = useMemo(() => buildSessionsOption(data, footer), [data, footer]);
  return <BaseChart option={option} height={120} testId="sessions-chart" />;
}
