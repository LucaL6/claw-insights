import { type ReactNode } from 'react';

import { useIsBelowMd } from '../../hooks/useIsBelowMd';
import { StaleOverlay } from '../gateway/StaleOverlay';
import { LayoutTabs } from './LayoutTabs';

interface Props {
  topBar: ReactNode;
  sessions: ReactNode;
  metrics: ReactNode;
}

export function MainLayout({ topBar, sessions, metrics }: Props) {
  const tabMode = useIsBelowMd();

  return (
    <div className="h-screen flex flex-col grid-bg bg-base text-fg overflow-hidden">
      <header className="backdrop-blur-sm sticky top-0 z-50 px-5 h-12 flex items-center border-b border-edge bg-surface-solid opacity-[0.97] flex-shrink-0">
        {topBar}
      </header>
      <main className="flex flex-col p-4 flex-1 min-h-0">
        {tabMode ? (
          <div className="flex-1 min-h-0 relative">
            <StaleOverlay />
            <LayoutTabs sessions={sessions} metrics={metrics} />
          </div>
        ) : (
          <div className="flex flex-col xl:grid xl:grid-cols-12 gap-0 flex-1 min-h-0 relative">
            <StaleOverlay />
            <div
              data-section="sessions"
              className="max-h-[40vh] xl:max-h-none xl:col-span-5 flex flex-col min-h-0 overflow-y-auto sb xl:pr-3 mb-3 xl:mb-0"
            >
              {sessions}
            </div>
            <div
              data-section="metrics"
              className="xl:col-span-7 flex flex-col gap-2 min-h-0 overflow-y-auto sb xl:pl-3"
            >
              {metrics}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
