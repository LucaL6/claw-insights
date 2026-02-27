import { useMemo } from 'react';

import { useI18n } from '../../i18n/context';
import { buildConversationsOption } from './builders/buildConversationsOption';
import { BaseChart } from './core/BaseChart';
import { getTooltips } from './metrics/metricsTooltips';
import type { RoleFilter } from './metrics/RoleSelector';

interface BucketData {
  bucket: number;
  label: string;
  turns: number;
  userTurns: number;
  assistantTurns: number;
}

export function ConversationsChart({ data, roleFilter = 'all' }: { data: BucketData[]; roleFilter?: RoleFilter }) {
  const { t } = useI18n();
  const footer = useMemo(() => getTooltips(t).chartFooter.conversations, [t]);
  const option = useMemo(() => buildConversationsOption(data, footer, roleFilter), [data, footer, roleFilter]);
  return <BaseChart option={option} height={120} testId="conversations-chart" />;
}
