// packages/web/src/components/topbar/TopBar.tsx
import { useGatewayData } from '../../hooks/useGatewayData';
import type { Page } from '../../hooks/useHashRoute';
import { useIsBelowMd } from '../../hooks/useIsBelowMd';
import { useSnapshot } from '../../hooks/useSnapshot';
import { useI18n } from '../../i18n/context';
import { useTheme } from '../../theme/context';
import { channelShortName } from '../../utils/format';
import type { MetricsRange } from '../charts/metrics/GranularityPicker';
import { CameraIcon, MoonIcon, SpinnerIcon, SunIcon } from '../ui/icons';
import { NavTabs } from './NavTabs';

const STATUS_STYLES = {
  running: { dot: 'bg-emerald', text: 'text-emerald' },
  'gateway-down': { dot: 'bg-red', text: 'text-red' },
  'dashboard-offline': { dot: 'bg-amber animate-pulse', text: 'text-amber' },
  connecting: { dot: 'bg-fg-dim animate-pulse', text: 'text-fg-dim' },
} as const;

function GatewayBar() {
  const { t } = useI18n();
  const { status, channels, resources, uptime, fetching } = useGatewayData();
  const style = STATUS_STYLES[status];
  const isDown = status === 'gateway-down';
  const isDashboardIssue = status === 'dashboard-offline' || status === 'connecting';

  const labelMap = {
    running: t('topbar.up'),
    'gateway-down': t('topbar.down'),
    'dashboard-offline': t('topbar.offline'),
    connecting: t('topbar.connecting'),
  } as const;

  const title = isDashboardIssue ? t('gateway.dashboardTitle') : t('gateway.title');

  return (
    <div className="flex items-center gap-3 px-1">
      {!isDashboardIssue && (
        <span className="text-sm" aria-hidden="true">
          🦞
        </span>
      )}
      <span
        className={`text-xs font-medium ${isDashboardIssue ? 'text-amber' : 'text-fg-secondary'}`}
      >
        {title}
      </span>
      <div className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        <span className={`text-xs font-medium ${style.text}`}>{labelMap[status]}</span>
      </div>
      {uptime && status === 'running' && <span className="text-xs mono text-fg-dim">{uptime}</span>}

      {!isDashboardIssue && channels.length > 0 && (
        <>
          <div className="w-px h-3 bg-edge" />
          <div className={`flex items-center gap-1.5 ${isDown ? 'opacity-30' : ''}`}>
            {fetching.channels
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-elevated/40 border border-edge-subtle"
                  >
                    <span className="w-1 h-1 rounded-full bg-fg-dim animate-pulse" />
                    <span className="inline-block w-6 h-2.5 rounded animate-pulse bg-skeleton" />
                  </div>
                ))
              : channels.map((c) => (
                  <div
                    key={`${c.provider}-${c.name}`}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-elevated/40 border border-edge-subtle"
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${isDown ? 'bg-fg-dim' : c.connected ? 'bg-emerald' : 'bg-red'}`}
                    />
                    <span className="text-xs text-fg-muted">{channelShortName(c.name)}</span>
                  </div>
                ))}
          </div>
        </>
      )}

      {!isDashboardIssue && (
        <>
          <div className="w-px h-3 bg-edge" />
          <div className={`flex items-center gap-2 ${isDown ? 'opacity-30' : ''}`}>
            <span className="text-xs uppercase tracking-wide text-fg-dim">{t('topbar.cpu')}</span>
            <span className="text-xs mono text-fg-secondary">
              {isDown || !resources ? '—' : `${resources.cpu.toFixed(1)}%`}
            </span>
            <span className="text-xs uppercase tracking-wide text-fg-dim">{t('topbar.mem')}</span>
            <span className="text-xs mono text-fg-secondary">
              {isDown || !resources ? '—' : `${resources.memoryMB}M`}
            </span>
          </div>
        </>
      )}

      {status === 'dashboard-offline' && (
        <>
          <div className="w-px h-3 bg-edge" />
          <span className="text-xs text-amber animate-pulse">{t('topbar.reconnecting')}</span>
        </>
      )}
    </div>
  );
}

export function TopBar({
  currentPage,
  onNavigate,
  metricsRange,
}: {
  currentPage?: Page;
  onNavigate?: (hash: string) => void;
  metricsRange?: MetricsRange;
}) {
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { snapshotting, takeSnapshot } = useSnapshot();
  const isMobile = useIsBelowMd();

  return (
    <div className="flex items-stretch justify-between text-xs w-full">
      {/* Left: Nav tabs (mobile) or Gateway status (desktop) */}
      <div className="flex items-stretch">
        {isMobile ? <NavTabs currentPage={currentPage} onNavigate={onNavigate} /> : <GatewayBar />}
      </div>

      {/* Right: Snapshot + Theme + Lang — ghost style */}
      <div className="flex items-center gap-0.5">
        <button
          disabled={snapshotting}
          onClick={() => {
            void takeSnapshot({
              section: currentPage === 'logs' ? 'logs' : 'dashboard',
              range: metricsRange ?? 'TWENTY_FOUR_HOUR',
              theme,
              lang,
            });
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
            snapshotting ? 'text-fg-dim cursor-wait' : 'text-fg-muted hover:text-fg-secondary hover:bg-elevated'
          }`}
          title={t('topbar.snapshot')}
        >
          {snapshotting ? <SpinnerIcon /> : <CameraIcon />}
          {t('topbar.snapshot')}
        </button>

        <button
          onClick={toggleTheme}
          className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-fg-muted hover:text-fg-secondary hover:bg-elevated"
          title={theme === 'dark' ? t('topbar.toggleThemeDark') : t('topbar.toggleThemeLight')}
        >
          {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
        </button>

        <button
          onClick={toggleLang}
          className="w-7 h-7 flex items-center justify-center text-[11px] font-semibold rounded-md transition-colors text-fg-muted hover:text-fg-secondary hover:bg-elevated"
          title={lang === 'en' ? t('topbar.toggleLangEn') : t('topbar.toggleLangZh')}
        >
          {lang === 'en' ? 'EN' : '中'}
        </button>
      </div>
    </div>
  );
}
