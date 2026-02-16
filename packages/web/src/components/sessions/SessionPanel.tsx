import { useState, useEffect } from 'react';
import { SessionsQuery } from '../../graphql/queries';
import { useReactiveQuery } from '../../hooks/useReactiveQuery';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { SessionSkeleton } from '../layout/Skeleton';
import { SessionGroup } from './SessionGroup';

type ViewMode = 'active' | 'all';
type SortBy = 'UPDATED_AT' | 'TOKENS_DESC' | 'NAME';

export function SessionPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [sortBy, setSortBy] = useState<SortBy>('UPDATED_AT');
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());

  const activeOnly = viewMode === 'active';

  const [result] = useReactiveQuery(
    { query: SessionsQuery, variables: { filter: { activeOnly, sortBy, grouped: true } }, requestPolicy: 'cache-and-network' },
    { sources: ['sessions'], debounceMs: 500 },
  );

  useEffect(() => {
    if (result.data) setLastFetchTime(Date.now());
  }, [result.data]);

  const sessions = result.data?.sessions ?? [];
  const activeCount = sessions.filter((s: { status: string }) => s.status === 'ACTIVE').length;

  const isActive = (v: ViewMode) => viewMode === v;
  const isSortActive = (s: SortBy) => sortBy === s;

  return (
    <CollapsibleSection title="Sessions" badge={`${activeCount} active · ${sessions.length} total`} updatedAt={lastFetchTime}>
      {/* Filter (left) + Sort (right) */}
      <div className="flex items-center justify-between mb-3">
        {/* Filter: view mode */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('active')}
            className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
              isActive('active')
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-zinc-800 text-zinc-500 border-zinc-700'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
              isActive('all')
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-zinc-800 text-zinc-500 border-zinc-700'
            }`}
          >
            All
          </button>
        </div>
        {/* Sort: ordering mode */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-zinc-600 mr-0.5">Sort</span>
          {([['UPDATED_AT', 'Recent'], ['TOKENS_DESC', 'Token'], ['NAME', 'Group']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSortBy(val)}
              className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                isSortActive(val)
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Session List */}
      <div className="space-y-2">
        {sessions.map((s: { key: string; displayName: string; kind: string; model: string; channel: string | null; totalTokens: number; contextTokens: number; usagePercent: number; status: string; updatedAt: number; subAgents: Array<{ key: string; label: string; status: string; totalTokens: number; updatedAt: number }> }) => (
          <SessionGroup key={s.key} session={s} />
        ))}
        {result.fetching && !result.data && (
          <>
            <SessionSkeleton />
            <SessionSkeleton />
            <SessionSkeleton />
          </>
        )}
        {!result.fetching && sessions.length === 0 && (
          <p className="text-zinc-600 text-xs">No sessions</p>
        )}
      </div>
    </CollapsibleSection>
  );
}
