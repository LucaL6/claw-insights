import type { ReactNode } from 'react';

interface Props {
  topBar: ReactNode;
  sessions: ReactNode;
  metrics: ReactNode;
  logs: ReactNode;
}

export function MainLayout({ topBar, sessions, metrics, logs }: Props) {
  return (
    <div className="bg-zinc-950 min-h-screen text-white font-sans flex flex-col">
      {/* TopBar */}
      <header className="border-b border-zinc-800 px-4 py-2 flex-shrink-0">
        {topBar}
      </header>

      {/* Main Content: 3-column grid */}
      <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Sessions Panel — left 3 cols */}
        <div className="col-span-3 overflow-y-auto max-h-[calc(100vh-80px)] pr-2 scrollbar-thin">
          {sessions}
        </div>

        {/* Metrics + Logs — right 9 cols */}
        <div className="col-span-9 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-80px)]">
          {metrics}
          {logs}
        </div>
      </main>
    </div>
  );
}
