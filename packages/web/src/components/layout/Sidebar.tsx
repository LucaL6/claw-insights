import { Fragment } from 'react';

import { useClock } from '../../hooks/useClock';
import type { Page } from '../../hooks/useHashRoute';
import { usePreference } from '../../hooks/usePreference';
import { useTopBarData } from '../../hooks/useTopBarData';
import { useI18n } from '../../i18n/context';
import { ChevronLeftIcon, ChevronRightIcon, DashboardIcon, LogsIcon } from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';

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
  const clock = useClock();

  const toggleLabel = collapsed ? t('sidebar.expand') : t('sidebar.collapse');

  return (
    <aside
      className={`flex flex-col h-full border-r border-edge bg-surface-solid transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-12' : 'w-[160px]'
      }`}
    >
      {/* Header: Clock with sky accent (expanded) or collapse toggle (collapsed) */}
      {collapsed ? (
        <div className="flex items-center justify-center h-12 flex-shrink-0 border-b border-edge-subtle px-2">
          <Tooltip text={toggleLabel} position="right">
            <button
              onClick={() => {
                setCollapsed(false);
              }}
              aria-label={toggleLabel}
              className="w-6 h-6 flex items-center justify-center rounded-md text-fg-dim hover:text-fg-muted hover:bg-elevated/50 transition-colors"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="flex flex-col px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-base mono font-semibold text-fg tabular-nums">{clock.time}</span>
            <button
              onClick={() => {
                setCollapsed(true);
              }}
              aria-label={toggleLabel}
              className="w-6 h-6 flex items-center justify-center rounded-md text-fg-dim hover:text-fg-muted hover:bg-elevated/50 transition-colors"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[10px] text-fg-muted mt-0.5">{clock.date}</span>
          <div className="mt-2 h-px bg-gradient-to-r from-sky/60 via-sky/20 to-transparent" />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2">
        {NAV_ITEMS.map(({ page, hash, icon: Icon, labelKey }) => {
          const active = currentPage === page;
          const link = (
            <a
              aria-current={active ? 'page' : undefined}
              aria-label={t(labelKey)}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(hash);
              }}
              href={hash}
              className={`flex items-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer mb-0.5 ${
                collapsed ? 'justify-center' : ''
              } ${
                active
                  ? `bg-elevated/60 text-fg border-l-[3px] border-sky ${collapsed ? 'px-2' : 'pl-[10px] pr-2'}`
                  : `text-fg-dim hover:text-fg-muted hover:bg-elevated/50 ${collapsed ? 'px-2' : 'pl-[13px] pr-2'}`
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-sky' : ''}`} />
              {!collapsed && <span>{t(labelKey)}</span>}
            </a>
          );
          return collapsed ? (
            <Tooltip key={page} text={t(labelKey)} position="right" as="div">
              {link}
            </Tooltip>
          ) : (
            <Fragment key={page}>{link}</Fragment>
          );
        })}
      </nav>

      {/* Footer: version only */}
      {!collapsed && (
        <div className="flex-shrink-0 border-t border-edge-subtle px-3 py-2">
          <div className="text-[10px] text-fg-secondary">
            {t('brand.name')} v{version}
          </div>
        </div>
      )}
    </aside>
  );
}
