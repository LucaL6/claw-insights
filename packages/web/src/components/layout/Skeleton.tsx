/** Animated skeleton placeholder for loading states */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-zinc-800/50 rounded animate-pulse ${className}`} />
  );
}

/** Chart-sized skeleton placeholder */
export function ChartSkeleton() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-[58px] w-full rounded" />
    </div>
  );
}

/** Session card skeleton placeholder */
export function SessionSkeleton() {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
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
