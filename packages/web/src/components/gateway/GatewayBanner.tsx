import type { GatewayStatus } from '../../hooks/useGatewayData';
import { useGatewayData } from '../../hooks/useGatewayData';
import { useI18n } from '../../i18n/context';
import { DoctorIcon } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';
import { channelShortName, formatLatency } from '../../utils/format';

function BannerStatusPill({ status }: { status: GatewayStatus }) {
  const { t } = useI18n();
  const config = {
    running: {
      bg: 'bg-emerald-bg',
      border: 'border-emerald-border',
      dot: 'bg-emerald pulse-dot',
      text: 'text-emerald',
      label: t('topbar.up'),
    },
    down: { bg: 'bg-red-bg', border: 'border-red-border', dot: 'bg-red', text: 'text-red', label: t('topbar.down') },
    connecting: {
      bg: 'bg-amber-bg',
      border: 'border-amber-border',
      dot: 'bg-amber pulse-dot',
      text: 'text-amber',
      label: t('topbar.connecting'),
    },
  }[status];

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${config.bg} border ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span className={`text-[10px] font-medium ${config.text}`}>{config.label}</span>
    </div>
  );
}

export function GatewayBanner({ onAction }: { onAction?: (action: 'restart' | 'doctor') => void }) {
  const { status, channels, resources, uptime, fetching } = useGatewayData();
  const { t } = useI18n();
  const isDown = status === 'down';
  const isConnecting = status === 'connecting';

  const bannerBorder = isDown ? 'pulse-border' : 'border-edge-subtle';
  const bannerBg = isDown ? 'bg-red-bg/30' : 'bg-surface/30';

  return (
    <div className={`rounded-lg border ${bannerBorder} ${bannerBg} transition-colors`}>
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Gateway identity + status */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-fg-secondary">{t('gateway.title')}</span>
          <BannerStatusPill status={status} />
          {uptime && !isDown && !isConnecting && (
            <span className="text-[10px] mono text-fg-dim">
              {t('gateway.uptime')} {uptime}
            </span>
          )}
        </div>

        {/* Center: Channels */}
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
                  <span className="text-[10px] text-fg-muted">{channelShortName(c.name)}</span>
                  {!isDown && c.latencyMs != null && (
                    <span className="text-[9px] mono text-fg-dim">{formatLatency(c.latencyMs)}</span>
                  )}
                  {/* no latency in down state */}
                </div>
              ))}
        </div>

        {/* Right: Resources + Actions */}
        <div className="flex items-center gap-3">
          {/* Resources */}
          <div
            className={`flex items-center gap-3 px-3 py-1 rounded-md bg-elevated/30 border border-edge-subtle ${isDown ? 'opacity-30' : ''}`}
          >
            {fetching.resources ? (
              <>
                <span className="text-[9px] uppercase tracking-wider text-fg-dim">{t('topbar.cpu')}</span>
                <span className="inline-block w-6 h-2.5 rounded animate-pulse bg-skeleton" />
                <div className="w-px h-3 bg-edge" />
                <span className="text-[9px] uppercase tracking-wider text-fg-dim">{t('topbar.mem')}</span>
                <span className="inline-block w-6 h-2.5 rounded animate-pulse bg-skeleton" />
              </>
            ) : (
              <>
                <span className="text-[9px] uppercase tracking-wider text-fg-dim">{t('topbar.cpu')}</span>
                <span className="text-[10px] mono text-fg-secondary">
                  {isDown || !resources ? '—' : `${resources.cpu.toFixed(1)}%`}
                </span>
                <div className="w-px h-3 bg-edge" />
                <span className="text-[9px] uppercase tracking-wider text-fg-dim">{t('topbar.mem')}</span>
                <span className="text-[10px] mono text-fg-secondary">
                  {isDown || !resources ? '—' : `${resources.memoryMB}M`}
                </span>
              </>
            )}
          </div>

          <div className="h-4 w-px bg-edge-subtle" />

          {/* Actions */}
          <Tooltip text={t('topbar.restart.tooltip')} detail={t('topbar.restart.tooltipDetail')} align="right">
            <button
              onClick={() => onAction?.('restart')}
              disabled={isConnecting}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
                isDown ? 'bg-red-bg text-red border-red-border hover:bg-red-bg/80' : 'btn-restart'
              } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              ↻ {t('topbar.restart')}
            </button>
          </Tooltip>
          <Tooltip text={t('topbar.doctor.tooltip')} detail={t('topbar.doctor.tooltipDetail')} align="right">
            <button
              onClick={() => onAction?.('doctor')}
              disabled={isConnecting}
              className={`btn-doctor flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md border transition-colors ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <DoctorIcon className="w-3 h-3" /> {t('topbar.doctor')}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
