import { type ReactNode, useEffect, useState } from 'react';

import { StaleOverlay } from '../gateway/StaleOverlay';
import { LayoutTabs } from './LayoutTabs';

interface Props {
  topBar: ReactNode;
  banner?: ReactNode;
  sessions: ReactNode;
  metrics: ReactNode;
}

const MD = 768;

function useIsBelowMd() {
  const [below, setBelow] = useState(() => typeof window !== 'undefined' && window.innerWidth < MD);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MD - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setBelow(e.matches);
    setBelow(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return below;
}

export function MainLayout({ topBar, banner, sessions, metrics }: Props) {
  const tabMode = useIsBelowMd();

  return (
    <div className="min-h-screen grid-bg overflow-hidden bg-base text-fg">
      <header className="backdrop-blur-sm sticky top-0 z-50 px-5 pt-2 pb-0 border-b border-edge bg-surface-solid opacity-[0.97]">
        {topBar}
      </header>
      <main className="flex flex-col p-4 h-[calc(100vh-45px)]">
        {banner && <div className="mb-3 flex-shrink-0">{banner}</div>}
        {tabMode ? (
          <div className="flex-1 min-h-0 relative">
            <StaleOverlay />
            <LayoutTabs sessions={sessions} metrics={metrics} />
          </div>
        ) : (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-0 flex-1 min-h-0 relative">
            <StaleOverlay />
            <div
              data-section="sessions"
              className="max-h-[40vh] lg:max-h-none lg:col-span-5 flex flex-col min-h-0 overflow-y-auto sb lg:pr-3 mb-3 lg:mb-0"
            >
              {sessions}
            </div>
            <div data-section="metrics" className="lg:col-span-7 flex flex-col gap-2 min-h-0 overflow-y-auto sb lg:pl-3">
              {metrics}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
