import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { useI18n } from '../../i18n/context';

export function StaleOverlay() {
  const connection = useConnectionStatus();
  const { t } = useI18n();

  if (connection !== 'reconnecting') {
    return null;
  }

  return (
    <div
      data-testid="stale-overlay"
      className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-surface/60 backdrop-blur-[1px]"
    >
      <span className="text-xs font-medium px-3 py-1.5 rounded-md bg-amber-bg border border-amber-border text-amber">
        ⚠ {t('overlay.staleData')}
      </span>
    </div>
  );
}
