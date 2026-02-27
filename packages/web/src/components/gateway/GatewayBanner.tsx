import type { GatewayStatus } from '../../hooks/useGatewayData';
import { useGatewayData } from '../../hooks/useGatewayData';
import { useI18n } from '../../i18n/context';
import { channelShortName, formatLatency } from '../../utils/format';

function BannerStatusPill({ status }: { status: GatewayStatus }) {
  const { t } = useI18n();
  const config: Record<GatewayStatus, { bg: string; border: string; dot: string; text: string; label: string }> = {
    running: {
      bg: 'bg-emerald-bg',
      border: 'border-emerald-border',
      dot: 'bg-emerald pulse-dot',
      text: 'text-emerald',
      label: t('topbar.up'),
    },
    'gateway-down': {
      bg: 'bg-red-bg',
      border: 'border-red-border',
      dot: 'bg-red',
      text: 'text-red',
      label: t('topbar.down'),
    },
    'dashboard-offline': {
      bg: 'bg-amber-bg',
      border: 'border-amber-border',
      dot: 'bg-amber pulse-dot',
      text: 'text-amber',
      label: t('topbar.offline'),
    },
    connecting: {
      bg: 'bg-surface',
      border: 'border-edge-subtle',
      dot: 'bg-fg-dim pulse-dot',
      text: 'text-fg-dim',
      label: t('topbar.connecting'),
    },
  };

  const c = config[status];
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${c.bg} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      <span className={`text-xs font-medium ${c.text}`}>{c.label}</span>
    </div>
  );
}

export function GatewayBanner() {
  const { status, channels, resources, uptime, fetching } = useGatewayData();
  const { t } = useI18n();
  const isDown = status === 'gateway-down';
  const isConnecting = status === 'connecting';
  const isOffline = status === 'dashboard-offline';
  const isDashboardIssue = isOffline || isConnecting;

  const bannerBorder = isDown ? 'pulse-border' : isOffline ? 'pulse-border-amber' : 'border-edge-subtle';
  const bannerBg = isDown ? 'bg-red-bg/30' : isOffline ? 'bg-amber-bg/30' : 'bg-surface/30';

  return (
    <div className={`rounded-lg border ${bannerBorder} ${bannerBg} transition-colors`}>
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: identity + status */}
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${isOffline ? 'text-amber' : 'text-fg-secondary'}`}>
            {isDashboardIssue ? t('gateway.dashboardTitle') : t('gateway.title')}
          </span>
          <BannerStatusPill status={status} />
          {uptime && !isDown && !isDashboardIssue && (
            <span className="text-xs mono text-fg-dim">
              {t('gateway.uptime')} {uptime}
            </span>
          )}
        </div>

        {/* Center: Channels — hidden for all dashboard issues */}
        {!isDashboardIssue && (
          <div className={`flex items-center gap-1.5 ${isDown ? 'opacity-30' : ''}`}>
            {fetching.channels
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-elevated border border-edge-subtle"
                  >
                    <span className="w-1 h-1 rounded-full bg-fg-dim animate-pulse" />
                    <span className="inline-block w-8 h-2.5 rounded animate-pulse bg-skeleton" />
                  </div>
                ))
              : channels.map((c) => (
                  <div
                    key={`${c.provider}-${c.name}`}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-elevated/40 border border-edge-subtle"
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${isDown ? 'bg-fg-dim' : c.connected ? 'bg-emerald' : 'bg-red'}`}
                    />
                    <span className="text-xs text-fg-muted">{channelShortName(c.name)}</span>
                    {!isDown && c.latencyMs != null && (
                      <span className="text-xs mono text-fg-dim">{formatLatency(c.latencyMs)}</span>
                    )}
                  </div>
                ))}
          </div>
        )}

        {/* Right: hidden for dashboard issues, show resources otherwise */}
        {isDashboardIssue ? (
          <div className="flex items-center gap-2">
            {isOffline && <span className="text-xs text-amber animate-pulse">{t('topbar.reconnecting')}</span>}
          </div>
        ) : (
          <div
            className={`flex items-center gap-3 px-3 py-1 rounded-md bg-elevated/30 border border-edge-subtle ${isDown ? 'opacity-30' : ''}`}
          >
            {fetching.resources ? (
              <>
                <span className="text-xs uppercase tracking-wide text-fg-dim">{t('topbar.cpu')}</span>
                <span className="inline-block w-6 h-2.5 rounded animate-pulse bg-skeleton" />
                <div className="w-px h-3 bg-edge" />
                <span className="text-xs uppercase tracking-wide text-fg-dim">{t('topbar.mem')}</span>
                <span className="inline-block w-6 h-2.5 rounded animate-pulse bg-skeleton" />
              </>
            ) : (
              <>
                <span className="text-xs uppercase tracking-wide text-fg-dim">{t('topbar.cpu')}</span>
                <span className="text-xs mono text-fg-secondary">
                  {isDown || !resources ? '—' : `${resources.cpu.toFixed(1)}%`}
                </span>
                <div className="w-px h-3 bg-edge" />
                <span className="text-xs uppercase tracking-wide text-fg-dim">{t('topbar.mem')}</span>
                <span className="text-xs mono text-fg-secondary">
                  {isDown || !resources ? '—' : `${resources.memoryMB}M`}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
