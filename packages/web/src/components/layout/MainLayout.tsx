import type { ReactNode } from 'react';

import { StaleOverlay } from '../gateway/StaleOverlay';

interface Props {
  topBar: ReactNode;
  banner?: ReactNode;
  sessions: ReactNode;
  metrics: ReactNode;
}

export function MainLayout({ topBar, banner, sessions, metrics }: Props) {
  return (
    <div className="min-h-screen grid-bg overflow-hidden bg-base text-fg">
      <header className="backdrop-blur-sm sticky top-0 z-50 px-5 py-2 border-b border-edge bg-surface-solid opacity-[0.97]">
        {topBar}
      </header>
      <main className="flex flex-col p-4 h-[calc(100vh-45px)]">
        {banner && <div className="mb-3 flex-shrink-0">{banner}</div>}
        <div className="grid grid-cols-12 gap-0 flex-1 min-h-0 relative">
          <StaleOverlay />
          <div
            data-section="sessions"
            className="col-span-5 flex flex-col min-h-0 overflow-y-auto sb pr-3 border-r border-edge-subtle"
          >
            {sessions}
          </div>
          <div data-section="metrics" className="col-span-7 flex flex-col gap-2 min-h-0 overflow-y-auto sb pl-3">
            {metrics}
          </div>
        </div>
      </main>
    </div>
  );
}
