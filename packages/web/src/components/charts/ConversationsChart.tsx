import { useMemo } from 'react';

import { useI18n } from '../../i18n/context';
import { buildConversationsOption } from './builders/buildConversationsOption';
import { BaseChart } from './core/BaseChart';
import { getTooltips } from './metrics/metricsTooltips';

interface BucketData {
  bucket: number;
  label: string;
  turns: number;
}

export function ConversationsChart({ data }: { data: BucketData[] }) {
  const { t } = useI18n();
  const footer = useMemo(() => getTooltips(t).chartFooter.sessions, [t]);
  const option = useMemo(() => buildConversationsOption(data, footer), [data, footer]);
  return <BaseChart option={option} height={120} testId="conversations-chart" />;
}
