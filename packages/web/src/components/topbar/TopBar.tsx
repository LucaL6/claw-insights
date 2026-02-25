// packages/web/src/components/topbar/TopBar.tsx
import type { Page } from '../../hooks/useHashRoute';
import { useSnapshot } from '../../hooks/useSnapshot';
import { useTopBarData } from '../../hooks/useTopBarData';
import { useI18n } from '../../i18n/context';
import { useTheme } from '../../theme/context';
import type { MetricsRange } from '../charts/metrics/GranularityPicker';
import { CameraIcon, SpinnerIcon } from '../ui/icons';
import { NavTabs } from './NavTabs';

export function TopBar({
  currentPage,
  onNavigate,
  metricsRange,
}: {
  currentPage?: Page;
  onNavigate?: (hash: string) => void;
  metricsRange?: MetricsRange;
}) {
  const { t } = useI18n();
  const { version, fetching } = useTopBarData();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang } = useI18n();
  const { snapshotting, takeSnapshot } = useSnapshot();

  return (
    <div className="flex items-center justify-between text-xs">
      {/* Left: Logo + Version */}
      <div className="flex items-center gap-2.5">
        <img src="/logo.svg" alt="" className="w-5 h-5 [filter:var(--icon-filter,none)]" />
        <span className="text-sm font-semibold tracking-tight text-fg">{t('brand.name')}</span>
        {fetching.gateway ? (
          <span className="inline-block w-16 h-3 rounded animate-pulse bg-skeleton" />
        ) : (
          <span className="text-[10px] mono text-fg-dim">v{version}</span>
        )}
      </div>

      {/* Center: Nav */}
      <NavTabs currentPage={currentPage} onNavigate={onNavigate} />

      {/* Right: Snapshot + Theme + Lang */}
      <div className="flex items-center gap-2">
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
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all ${
            snapshotting
              ? 'bg-emerald-bg text-emerald border border-emerald-border opacity-80'
              : 'bg-elevated text-fg-secondary border border-edge'
          }`}
          title={t('topbar.snapshot')}
        >
          {snapshotting ? <SpinnerIcon /> : <CameraIcon />}
          {snapshotting ? t('topbar.snapshotting') : t('topbar.snapshot')}
        </button>

        <div className="h-4 w-px bg-edge-subtle" />

        <button
          onClick={toggleTheme}
          className="w-7 h-7 flex items-center justify-center text-sm rounded-md transition-colors bg-theme-btn-bg text-theme-btn-text border border-edge-subtle"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>

        <button
          onClick={toggleLang}
          className="w-7 h-7 flex items-center justify-center text-sm rounded-md transition-colors bg-elevated text-fg-muted border border-edge-subtle"
          title={lang === 'en' ? 'Switch to 中文' : 'Switch to English'}
        >
          🌐
        </button>
      </div>
    </div>
  );
}
