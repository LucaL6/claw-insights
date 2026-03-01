import type { ReactNode } from 'react';

export function ChartCard({ children }: { children: ReactNode }) {
  return <div className="rounded-lg px-4 py-3 bg-surface border border-edge shadow-card min-w-0">{children}</div>;
}
