import type { Page } from '../../hooks/useHashRoute';
import { useI18n } from '../../i18n/context';

interface NavTabsProps {
  currentPage?: Page;
  onNavigate?: (hash: string) => void;
}

export function NavTabs({ currentPage, onNavigate }: NavTabsProps) {
  const { t } = useI18n();

  const tabStyle = (active: boolean) =>
    active
      ? {
          backgroundColor: 'var(--bg-surface-solid)',
          color: 'var(--text-primary)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        } // inline: dynamic boxShadow
      : { color: 'var(--text-dim)' };

  return (
    <div className="inline-flex rounded-lg p-0.5 gap-px bg-elevated">
      <button
        onClick={() => onNavigate?.('#dashboard')}
        className="text-[11px] font-semibold px-4 py-1 rounded-md transition-all"
        style={tabStyle(currentPage === 'dashboard')}
      >
        {t('nav.dashboard')}
      </button>
      <button
        onClick={() => onNavigate?.('#logs')}
        className="text-[11px] font-semibold px-4 py-1 rounded-md transition-all"
        style={tabStyle(currentPage === 'logs')}
      >
        {t('nav.logs')}
      </button>
    </div>
  );
}
