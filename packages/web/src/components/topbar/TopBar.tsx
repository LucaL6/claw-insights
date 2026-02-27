// packages/web/src/components/topbar/TopBar.tsx
import type { Page } from '../../hooks/useHashRoute';
import { useSnapshot } from '../../hooks/useSnapshot';
import { useTopBarData } from '../../hooks/useTopBarData';
import { useI18n } from '../../i18n/context';
import { useTheme } from '../../theme/context';
import type { MetricsRange } from '../charts/metrics/GranularityPicker';
import { CameraIcon, MoonIcon, SpinnerIcon, SunIcon } from '../ui/icons';
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
    <div className="flex items-stretch justify-between text-xs">
      {/* Left: Logo + Version + Nav */}
      <div className="flex items-stretch gap-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="w-5 h-5 [filter:var(--icon-filter,none)]" />
          <span className="text-sm font-semibold tracking-tight text-fg">{t('brand.name')}</span>
          {fetching.gateway ? (
            <span className="inline-block w-16 h-3 rounded animate-pulse bg-skeleton" />
          ) : (
            <span className="text-xs mono text-fg-dim">v{version}</span>
          )}
        </div>
        <NavTabs currentPage={currentPage} onNavigate={onNavigate} />
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
