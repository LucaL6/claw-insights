// packages/web/src/components/topbar/TopBar.tsx
import { useGatewayData } from '../../hooks/useGatewayData';
import type { Page } from '../../hooks/useHashRoute';
import { useIsBelowMd } from '../../hooks/useIsBelowMd';
import { useSnapshot } from '../../hooks/useSnapshot';
import { useI18n } from '../../i18n/context';
import { useTheme } from '../../theme/context';
import { formatUptime as fmtUptime } from '../../utils/format';
import type { MetricsRange } from '../charts/metrics/GranularityPicker';
import { CameraIcon, MoonIcon, SpinnerIcon, SunIcon } from '../ui/icons';
import { NavTabs } from './NavTabs';

const STATUS_STYLES = {
  running: { dot: 'bg-emerald', text: 'text-emerald' },
  'gateway-down': { dot: 'bg-red', text: 'text-red' },
  'dashboard-offline': { dot: 'bg-amber animate-pulse', text: 'text-amber' },
  connecting: { dot: 'bg-fg-dim animate-pulse', text: 'text-fg-dim' },
} as const;

function GatewayStatus() {
  const { t } = useI18n();
  const { status, gateway } = useGatewayData();
  const style = STATUS_STYLES[status];
  const uptime = gateway?.startedAt ? fmtUptime(gateway.startedAt) : null;

  const labelMap = {
    running: t('topbar.up'),
    'gateway-down': t('topbar.down'),
    'dashboard-offline': t('topbar.offline'),
    connecting: t('topbar.connecting'),
  } as const;

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-sm" aria-hidden="true">
        🦞
      </span>
      <span className="text-xs font-medium text-fg-secondary">{t('gateway.title')}</span>
      <div className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        <span className={`text-xs font-medium ${style.text}`}>{labelMap[status]}</span>
      </div>
      {uptime && status === 'running' && <span className="text-xs mono text-fg-dim">{uptime}</span>}
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
    <div className="flex items-stretch justify-between text-xs">
      {/* Left: Nav tabs (mobile) or Gateway status (desktop) */}
      <div className="flex items-stretch">
        {isMobile ? <NavTabs currentPage={currentPage} onNavigate={onNavigate} /> : <GatewayStatus />}
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
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
        </button>

        <button
          onClick={toggleLang}
          className="w-7 h-7 flex items-center justify-center text-[11px] font-semibold rounded-md transition-colors text-fg-muted hover:text-fg-secondary hover:bg-elevated"
          title={lang === 'en' ? 'Switch to 中文' : 'Switch to English'}
        >
          {lang === 'en' ? 'EN' : '中'}
        </button>
      </div>
    </div>
  );
}
