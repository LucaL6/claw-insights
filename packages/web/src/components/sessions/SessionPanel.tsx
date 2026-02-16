import { useState, useEffect } from 'react';
import { SessionsQuery } from '../../graphql/queries';
import { useReactiveQuery } from '../../hooks/useReactiveQuery';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { SessionSkeleton } from '../layout/Skeleton';
import { SessionGroup } from './SessionGroup';
import { useI18n } from '../../i18n/context';

type ViewMode = 'active' | 'all';
type SortBy = 'UPDATED_AT' | 'TOKENS_DESC' | 'NAME';

export function SessionPanel() {
  const { t } = useI18n();
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
    <CollapsibleSection title={t('sessions.title')} badge={t('sessions.activeBadge', { active: activeCount, total: sessions.length })} updatedAt={lastFetchTime}>
      {/* Filter (left) + Sort (right) */}
      <div className="flex items-center justify-between mb-3">
        {/* Filter: view mode */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('active')}
            className="px-2 py-0.5 text-[10px] rounded transition-colors"
            style={isActive('active')
              ? { backgroundColor: 'var(--toggle-active-bg)', color: 'var(--toggle-active-text)', border: '1px solid var(--toggle-active-border)' }
              : { backgroundColor: 'var(--toggle-inactive-bg)', color: 'var(--toggle-inactive-text)', border: '1px solid var(--toggle-inactive-border)' }
            }
          >
            {t('sessions.active')}
          </button>
          <button
            onClick={() => setViewMode('all')}
            className="px-2 py-0.5 text-[10px] rounded transition-colors"
            style={isActive('all')
              ? { backgroundColor: 'var(--toggle-active-bg)', color: 'var(--toggle-active-text)', border: '1px solid var(--toggle-active-border)' }
              : { backgroundColor: 'var(--toggle-inactive-bg)', color: 'var(--toggle-inactive-text)', border: '1px solid var(--toggle-inactive-border)' }
            }
          >
            {t('sessions.all')}
          </button>
        </div>
        {/* Sort: ordering mode */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] mr-0.5" style={{ color: 'var(--text-dim)' }}>{t('sessions.sort')}</span>
          {[
            { val: 'UPDATED_AT' as SortBy, label: t('sessions.recent') },
            { val: 'TOKENS_DESC' as SortBy, label: t('sessions.token') },
            { val: 'NAME' as SortBy, label: t('sessions.group') },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setSortBy(val)}
              className="px-2 py-0.5 text-[10px] rounded transition-colors"
              style={isSortActive(val)
                ? { backgroundColor: 'var(--toggle-sort-bg)', color: 'var(--toggle-sort-text)', border: '1px solid var(--toggle-sort-border)' }
                : { backgroundColor: 'var(--toggle-inactive-bg)', color: 'var(--toggle-inactive-text)', border: '1px solid var(--toggle-inactive-border)' }
              }
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
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{t('sessions.noSessions')}</p>
        )}
      </div>
    </CollapsibleSection>
  );
}
