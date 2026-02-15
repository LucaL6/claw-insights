import { useState } from 'react';
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

  const activeOnly = viewMode === 'active';

  const [result] = useReactiveQuery(
    { query: SessionsQuery, variables: { filter: { activeOnly, sortBy, grouped: true } }, requestPolicy: 'cache-and-network' },
    { sources: ['sessions'], debounceMs: 500 },
  );

  const sessions = result.data?.sessions ?? [];
  const activeCount = sessions.filter((s: { status: string }) => s.status === 'ACTIVE').length;

  const isActive = (v: ViewMode) => viewMode === v;
  const isSortActive = (s: SortBy) => sortBy === s;

  return (
    <CollapsibleSection title="Sessions" badge={`${activeCount} active · ${sessions.length} total`}>
      {/* V7 Filter Buttons */}
      <div className="flex items-center justify-between mb-3">
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
          <button
            onClick={() => setSortBy('NAME')}
            className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
              isSortActive('NAME')
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                : 'bg-zinc-800 text-zinc-500 border-zinc-700'
            }`}
          >
            🌲 Group
          </button>
          <button
            onClick={() => setSortBy(sortBy === 'TOKENS_DESC' ? 'UPDATED_AT' : 'TOKENS_DESC')}
            className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
              isSortActive('TOKENS_DESC')
                ? 'bg-zinc-700 text-zinc-300 border-zinc-600'
                : 'bg-zinc-800 text-zinc-500 border-zinc-700'
            }`}
          >
            Token ↓
          </button>
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
