import type { ReactNode } from 'react';

type Accent = 'sessions' | 'tokens' | 'errors' | 'uptime';

export function ChartCard({ children, accent }: { children: ReactNode; accent: Accent }) {
  return (
    <div
      className="rounded-lg px-4 py-3 relative overflow-hidden bg-surface border border-edge shadow-card"
      style={{
        backgroundImage: `var(--card-bg-${accent})`,
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `var(--card-accent-${accent})` }} />
      {children}
    </div>
  );
}
