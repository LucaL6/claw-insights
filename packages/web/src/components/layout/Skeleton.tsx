export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded animate-pulse ${className}`} style={{ backgroundColor: 'var(--skeleton)' }} />
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-lg px-3 py-2.5 bg-surface border border-edge">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-[58px] w-full rounded" />
    </div>
  );
}

export function SessionSkeleton() {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--subagent-bg)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex justify-between mt-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
