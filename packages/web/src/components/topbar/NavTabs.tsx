import type { Page } from '../../hooks/useHashRoute';
import { useI18n } from '../../i18n/context';

interface NavTabsProps {
  currentPage?: Page;
  onNavigate?: (hash: string) => void;
}

export function NavTabs({ currentPage, onNavigate }: NavTabsProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-stretch gap-4">
      <button
        onClick={() => onNavigate?.('#dashboard')}
        className={`text-xs font-semibold px-1 flex items-center border-b-2 transition-colors ${
          currentPage === 'dashboard'
            ? 'text-fg border-indigo-400'
            : 'text-fg-dim border-transparent hover:text-fg-muted'
        }`}
      >
        {t('nav.dashboard')}
      </button>
      <button
        onClick={() => onNavigate?.('#logs')}
        className={`text-xs font-semibold px-1 flex items-center border-b-2 transition-colors ${
          currentPage === 'logs'
            ? 'text-fg border-indigo-400'
            : 'text-fg-dim border-transparent hover:text-fg-muted'
        }`}
      >
        {t('nav.logs')}
      </button>
    </div>
  );
}
