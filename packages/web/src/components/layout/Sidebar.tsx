import type { Page } from '../../hooks/useHashRoute';
import { usePreference } from '../../hooks/usePreference';
import { useTopBarData } from '../../hooks/useTopBarData';
import { useI18n } from '../../i18n/context';
import { ChevronLeftIcon, ChevronRightIcon, DashboardIcon, LogsIcon } from '../ui/icons';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (hash: string) => void;
}

const NAV_ITEMS: { page: Page; hash: string; icon: typeof DashboardIcon; labelKey: string }[] = [
  { page: 'dashboard', hash: '#dashboard', icon: DashboardIcon, labelKey: 'nav.dashboard' },
  { page: 'logs', hash: '#logs', icon: LogsIcon, labelKey: 'nav.logs' },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = usePreference('sidebar-collapsed', false);
  const { t } = useI18n();
  const { version } = useTopBarData();

  const toggleLabel = collapsed ? t('sidebar.expand') : t('sidebar.collapse');

  return (
    <aside
      className={`flex flex-col h-full border-r border-edge bg-surface-solid transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-12' : 'w-[200px]'
      }`}
    >
      {/* Header: Brand + collapse toggle */}
      <div
        className={`flex items-center h-12 flex-shrink-0 border-b border-edge-subtle ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}`}
      >
        <div className={`flex items-center ${collapsed ? '' : 'gap-2'}`}>
          <span className="text-base" aria-hidden="true">
            💡
          </span>
          {!collapsed && <span className="text-sm font-semibold text-fg whitespace-nowrap">{t('brand.name')}</span>}
        </div>
        <button
          onClick={() => {
            setCollapsed((prev) => !prev);
          }}
          aria-label={toggleLabel}
          title={toggleLabel}
          className={`w-6 h-6 flex items-center justify-center rounded-md text-fg-dim hover:text-fg-muted hover:bg-elevated/50 transition-colors ${collapsed ? 'mt-0.5' : ''}`}
        >
          {collapsed ? <ChevronRightIcon className="w-3.5 h-3.5" /> : <ChevronLeftIcon className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2">
        {NAV_ITEMS.map(({ page, hash, icon: Icon, labelKey }) => {
          const active = currentPage === page;
          return (
            <a
              key={page}
              aria-current={active ? 'page' : undefined}
              aria-label={t(labelKey)}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(hash);
              }}
              href={hash}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer mb-0.5 ${
                active ? 'bg-elevated text-fg' : 'text-fg-dim hover:text-fg-muted hover:bg-elevated/50'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? t(labelKey) : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{t(labelKey)}</span>}
            </a>
          );
        })}
      </nav>

      {/* Footer: version only */}
      {!collapsed && (
        <div className="flex-shrink-0 border-t border-edge-subtle px-3 py-2">
          <div className="text-[10px] text-fg-dim/50">
            💡 {t('brand.name')} v{version}
          </div>
        </div>
      )}
    </aside>
  );
}
