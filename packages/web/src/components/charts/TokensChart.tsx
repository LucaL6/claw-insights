import { useMemo } from 'react';

import { useI18n } from '../../i18n/context';
import { buildTokensOption } from './builders/buildTokensOption';
import { BaseChart } from './core/BaseChart';
import { getTooltips } from './metrics/metricsTooltips';

interface ModelTokens {
  model: string;
  tokensK: number;
}
interface BucketData {
  bucket: number;
  label: string;
  tokensK: number;
  tokensByModel?: ModelTokens[];
}
interface Props {
  data: BucketData[];
  selectedModel?: string | null;
}

export function TokensChart({ data, selectedModel }: Props) {
  const { t } = useI18n();
  const footer = useMemo(() => getTooltips(t).chartFooter.tokens(selectedModel), [t, selectedModel]);
  const chartLabels = useMemo(() => ({ tokens: t('charts.tokens'), total: t('charts.total') }), [t]);
  const option = useMemo(() => buildTokensOption(data, selectedModel ?? null, footer, chartLabels), [data, selectedModel, footer, chartLabels]);
  return <BaseChart option={option} height={120} testId="tokens-chart" />;
}
