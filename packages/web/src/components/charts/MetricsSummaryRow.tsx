import { useMemo } from 'react';
import { InfoTooltip } from '../ui/InfoTooltip';
import { getTooltips } from './metricsTooltips';
import { useI18n } from '../../i18n/context';

interface Props {
  totalTokensK: number;
  totalErrors: number;
  totalWarnings: number;
  uptimePct: number;
}

export function MetricsSummaryRow({ totalTokensK, totalErrors, totalWarnings, uptimePct }: Props) {
  const { t } = useI18n();
  const TOOLTIPS = useMemo(() => getTooltips(t), [t]);

  return (
    <div className="flex gap-5 mb-3 text-[12px]">
      <span className="text-fg-muted">
        {t('summary.tokens')}: <span className="mono font-semibold text-emerald">{totalTokensK.toFixed(1)}k</span>
        <InfoTooltip {...TOOLTIPS.summary.summaryTokens} />
      </span>
      <span className="text-fg-muted">
        {t('summary.errors')}: <span className="mono font-semibold text-red">{totalErrors}</span>
        <InfoTooltip {...TOOLTIPS.summary.summaryErrors} />
      </span>
      <span className="text-fg-muted">
        {t('summary.warnings')}: <span className="mono font-semibold text-amber">{totalWarnings}</span>
        <InfoTooltip {...TOOLTIPS.summary.summaryWarnings} />
      </span>
      <span className="text-fg-muted">
        {t('summary.uptime')}: <span className="mono font-semibold text-emerald">{uptimePct.toFixed(1)}%</span>
        <InfoTooltip {...TOOLTIPS.summary.uptime} />
      </span>
    </div>
  );
}
