import type { ReactNode } from 'react';

interface Props {
  topBar: ReactNode;
  sessions: ReactNode;
  metrics: ReactNode;
  logs: ReactNode;
}

export function MainLayout({ topBar, sessions, metrics, logs }: Props) {
  return (
    <div className="bg-zinc-950 min-h-screen grid-bg text-white overflow-hidden">
      {/* TopBar — sticky with blur */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-50 px-5 py-2">
        {topBar}
      </header>

      {/* Main Content: Sessions (5) + Charts/Logs (7) */}
      <main className="grid grid-cols-12 gap-3 p-3" style={{ height: 'calc(100vh - 45px)' }}>
        {/* Sessions Panel — left 5 cols */}
        <div className="col-span-5 flex flex-col min-h-0 overflow-y-auto sb pr-1">
          {sessions}
        </div>

        {/* Metrics + Logs — right 7 cols */}
        <div className="col-span-7 flex flex-col gap-2 min-h-0 overflow-y-auto sb">
          {metrics}
          {logs}
        </div>
      </main>
    </div>
  );
}
