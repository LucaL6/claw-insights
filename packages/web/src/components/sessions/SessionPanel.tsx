import { useState } from 'react';
import { useQuery } from 'urql';
import { SessionsQuery } from '../../graphql/queries';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { SessionGroup } from './SessionGroup';

type SortBy = 'UPDATED_AT' | 'TOKENS_DESC' | 'NAME';

export function SessionPanel() {
  const [activeOnly, setActiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('UPDATED_AT');

  const [result] = useQuery({
    query: SessionsQuery,
    variables: { filter: { activeOnly, sortBy, grouped: true } },
    requestPolicy: 'cache-and-network',
    pollInterval: 30_000,
  });

  const sessions = result.data?.sessions ?? [];

  // Compute stats
  const activeCount = sessions.filter((s: { status: string }) => s.status === 'ACTIVE').length;

  return (
    <CollapsibleSection title="Sessions" badge={`${activeCount} active · ${sessions.length} total`}>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 text-[10px]">
        <button
          onClick={() => setActiveOnly(!activeOnly)}
          className={`px-2 py-0.5 rounded border ${
            activeOnly ? 'border-cyan-700 text-cyan-400 bg-cyan-950/30' : 'border-zinc-700 text-zinc-500'
          }`}
        >
          Active Only
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="bg-zinc-900 border border-zinc-700 text-zinc-400 rounded px-1.5 py-0.5 text-[10px]"
        >
          <option value="UPDATED_AT">Recent</option>
          <option value="TOKENS_DESC">Tokens ↓</option>
          <option value="NAME">Name</option>
        </select>
      </div>

      {/* Session List */}
      <div className="space-y-2">
        {sessions.map((s: { key: string; displayName: string; kind: string; model: string; channel: string | null; totalTokens: number; usagePercent: number; status: string; subAgents: Array<{ key: string; label: string; status: string; totalTokens: number; updatedAt: number }> }) => (
          <SessionGroup key={s.key} session={s} />
        ))}
        {sessions.length === 0 && (
          <p className="text-zinc-600 text-xs">No sessions</p>
        )}
      </div>
    </CollapsibleSection>
  );
}
