import { useSnapshot } from '../../hooks/useSnapshot';
import { useI18n } from '../../i18n/context';
import { useTheme } from '../../theme/context';
import type { MetricsRange } from '../charts/metrics/GranularityPicker';
import { CameraIcon, DoctorIcon, RestartIcon, SpinnerIcon } from '../ui/icons';

interface Props {
  onAction?: (action: 'restart' | 'doctor') => void;
  metricsRange?: MetricsRange;
  uptime: string | undefined;
  currentPage?: string;
}

export function ActionBar({ onAction, metricsRange, uptime, currentPage }: Props) {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const { snapshotting, takeSnapshot } = useSnapshot();

  return (
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

      <button
        onClick={() => onAction?.('restart')}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all bg-elevated text-fg-secondary border border-edge"
      >
        <RestartIcon />
        {t('topbar.restart')}
      </button>

      <button
        onClick={() => onAction?.('doctor')}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all bg-elevated text-fg-secondary border border-edge"
      >
        <DoctorIcon />
        {t('topbar.doctor')}
      </button>

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

      {uptime && (
        <>
          <div className="w-px h-4 mx-0.5 bg-edge" />
          <span className="text-[10px] mono text-fg-dim">⏱ {uptime}</span>
        </>
      )}
    </div>
  );
}
