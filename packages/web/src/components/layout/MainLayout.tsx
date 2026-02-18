import type { ReactNode } from 'react';

interface Props {
  topBar: ReactNode;
  sessions: ReactNode;
  metrics: ReactNode;
}

export function MainLayout({ topBar, sessions, metrics }: Props) {
  return (
    <div className="min-h-screen grid-bg overflow-hidden bg-base text-fg">
      <header className="backdrop-blur-sm sticky top-0 z-50 px-5 py-2 border-b border-edge bg-surface-solid opacity-[0.97]">
        {topBar}
      </header>
      <main className="grid grid-cols-12 gap-0 p-4 h-[calc(100vh-45px)]">
        <div
          data-section="sessions"
          className="col-span-5 flex flex-col min-h-0 overflow-y-auto sb pr-3 border-r border-edge-subtle"
        >
          {sessions}
        </div>
        <div data-section="metrics" className="col-span-7 flex flex-col gap-2 min-h-0 overflow-y-auto sb pl-3">
          {metrics}
        </div>
      </main>
    </div>
  );
}
