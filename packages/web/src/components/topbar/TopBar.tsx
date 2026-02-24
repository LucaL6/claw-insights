import type { Page } from '../../hooks/useHashRoute';
import { useTopBarData } from '../../hooks/useTopBarData';
import { useI18n } from '../../i18n/context';
import type { MetricsRange } from '../charts/metrics/GranularityPicker';
import { ActionBar } from './ActionBar';
import { ChannelPills } from './ChannelPills';
import { NavTabs } from './NavTabs';
import { ResourcesBar } from './ResourcesBar';
import { StatusPill } from './StatusPill';

export function TopBar({
  currentPage,
  onNavigate,
  onAction,
  metricsRange,
}: {
  currentPage?: Page;
  onNavigate?: (hash: string) => void;
  onAction?: (action: 'restart' | 'doctor') => void;
  metricsRange?: MetricsRange;
}) {
  const { t } = useI18n();
  const { gateway, resources, channels, uptime, version, fetching } = useTopBarData();

  return (
    <div className="flex items-center justify-between text-xs">
      {/* Left: Logo + Version + Status + Channels */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="w-5 h-5 [filter:var(--icon-filter,none)]" />
          <span className="text-sm font-semibold tracking-tight text-fg">{t('brand.name')}</span>
          {fetching.gateway ? (
            <span className="inline-block w-16 h-3 rounded animate-pulse bg-skeleton" />
          ) : (
            <span className="text-[10px] mono text-fg-dim">v{version}</span>
          )}
        </div>
        <StatusPill running={gateway?.running} fetching={fetching.gateway} />
        <ChannelPills channels={channels} fetching={fetching.channels} />
      </div>

      <NavTabs currentPage={currentPage} onNavigate={onNavigate} />
      <ResourcesBar resources={resources} fetching={fetching.resources} />

      <ActionBar
        onAction={onAction}
        metricsRange={metricsRange}
        uptime={uptime}
        currentPage={currentPage}
      />
    </div>
  );
}
