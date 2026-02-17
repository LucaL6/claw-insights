import { useTheme } from '../../theme/context';
import { useI18n } from '../../i18n/context';
import { useScreenshot } from '../../hooks/useScreenshot';
import { RestartIcon, DoctorIcon, DownloadIcon, CameraIcon, SpinnerIcon } from '../ui/icons';
import type { MetricsRange } from '../charts/GranularityPicker';

interface Props {
  onAction?: (action: 'restart' | 'doctor' | 'update') => void;
  metricsRange?: MetricsRange;
  updateLabel: string | null;
  uptime: string | undefined;
  currentPage?: string;
}

export function ActionBar({ onAction, metricsRange, updateLabel, uptime, currentPage }: Props) {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const { screenshotting, takeScreenshot } = useScreenshot();

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={screenshotting}
        onClick={() => takeScreenshot({
          section: currentPage === 'logs' ? 'logs' : 'dashboard',
          range: metricsRange ?? 'TWENTY_FOUR_HOUR',
          theme,
          lang,
        })}
        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all"
        style={{
          backgroundColor: screenshotting ? 'var(--emerald-bg)' : 'var(--bg-elevated)',
          color: screenshotting ? 'var(--emerald)' : 'var(--text-secondary)',
          border: screenshotting ? '1px solid var(--emerald-border)' : '1px solid var(--border)',
          opacity: screenshotting ? 0.8 : 1,
        }}
        title={t('topbar.screenshot')}
      >
        {screenshotting ? <SpinnerIcon /> : <CameraIcon />}
        {screenshotting ? t('topbar.screenshotting') : t('topbar.screenshot')}
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

      {updateLabel && (
        <button
          onClick={() => onAction?.('update')}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all bg-orange-bg text-orange border border-orange-border"
        >
          <DownloadIcon />
          {updateLabel}
        </button>
      )}

      <button
        onClick={toggleTheme}
        className="w-7 h-7 flex items-center justify-center text-sm rounded-md transition-colors"
        style={{ backgroundColor: 'var(--theme-btn-bg)', color: 'var(--theme-btn-text)', border: '1px solid var(--border-subtle)' }}
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
