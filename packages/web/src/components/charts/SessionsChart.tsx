import { useMemo } from 'react';

import { useI18n } from '../../i18n/context';
import { buildSessionsOption } from './builders/buildSessionsOption';
import { BaseChart } from './core/BaseChart';
import { getTooltips } from './metrics/metricsTooltips';

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
