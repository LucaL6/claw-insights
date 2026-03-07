import { useCallback, useEffect, useState } from 'react';

import { isSchemaV2Enabled } from '../../config/feature-flags';
import { getFallbackMode, getFallbackReasonTag, shouldFallbackToV1 } from '../../graphql/fallback-policy';
import { SessionsQuery } from '../../graphql/queries';
import { SessionsV2Query } from '../../graphql/queries-v2';
import { getDashboardSourceSelector } from '../../graphql/source-selector';
import { useHashRoute } from '../../hooks/useHashRoute';
import { usePreference } from '../../hooks/usePreference';
import { useReactiveQuery } from '../../hooks/useReactiveQuery';
import { useI18n } from '../../i18n/context';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { SessionSkeleton } from '../layout/Skeleton';
import { SessionDrawer } from './SessionDrawer';
import { SessionGroup } from './SessionGroup';
import { ToggleButton } from './shared/ToggleButton';
import type { SessionData } from './shared/types';

type ViewMode = 'active' | 'all';
type SortBy = 'UPDATED_AT' | 'TOKENS_DESC' | 'NAME';

export function SessionPanel({ onReady }: { onReady?: () => void } = {}) {
  const { t } = useI18n();
  const { route, navigate } = useHashRoute();
  const selectedKey = route.page === 'dashboard' ? route.params.session || null : null;

  const handleSelect = useCallback(
    (key: string) => {
      navigate(`#dashboard?session=${encodeURIComponent(key)}`);
    },
    [navigate],
  );

  const handleClose = useCallback(() => {
    navigate('#dashboard');
  }, [navigate]);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [sortBy, setSortBy] = usePreference<SortBy>('session-sort', 'UPDATED_AT', {
    validate: (v) => ['UPDATED_AT', 'TOKENS_DESC', 'NAME'].includes(v),
  });
  const [lastFetchTime, setLastFetchTime] = useState(0);

  const activeOnly = viewMode === 'active';

  // --- v2 dual-path ---
  const schemaV2 = isSchemaV2Enabled();
  const [fallbackToV1, setFallbackToV1] = useState(false);
  const useV2Path = schemaV2 && !fallbackToV1;
  const selector = getDashboardSourceSelector();

  const [v2Result] = useReactiveQuery(
    {
      query: SessionsV2Query,
      variables: { selector, filter: { activeOnly, sortBy, grouped: true } },
      requestPolicy: 'cache-and-network',
      pause: !useV2Path,
    },
    { sources: ['sessions'], debounceMs: 500 },
  );

  const [v1Result] = useReactiveQuery(
    {
      query: SessionsQuery,
      variables: { filter: { activeOnly, sortBy, grouped: true } },
      requestPolicy: 'cache-and-network',
      pause: useV2Path,
    },
    { sources: ['sessions'], debounceMs: 500 },
  );

  // Determine v2 source data
  const v2Source = v2Result.data?.source;
  const v2SourceNull = useV2Path && !v2Result.fetching && v2Result.data != null && !v2Source;
  const v2ShouldFallback = shouldFallbackToV1({
    surface: 'source',
    namespaceMissing: v2SourceNull,
    error: v2Result.error,
  });
  const v2ReasonTag = getFallbackReasonTag({
    surface: 'source',
    namespaceMissing: v2SourceNull,
    error: v2Result.error,
  });

  // Trigger fallback
  useEffect(() => {
    if (!schemaV2 || fallbackToV1 || !v2ShouldFallback || !v2ReasonTag) {
      return;
    }

    setFallbackToV1(true);
    const mode = getFallbackMode(v2ReasonTag);
    console.warn('[SessionPanel] fallback to v1', { reasonTag: v2ReasonTag, mode, surface: 'source' });
  }, [schemaV2, fallbackToV1, v2ShouldFallback, v2ReasonTag]);

  // Reset fallback when user changes filters or selector changes
  useEffect(() => {
    if (schemaV2 && fallbackToV1) {
      setFallbackToV1(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, sortBy, selector.id]);

  // Pick active result — normalise v2 shape to match v1 { sessions: [...] }
  const v2Sessions = v2Source ? v2Source.sessions : [];
  const result = useV2Path
    ? {
        data: v2Result.data ? { sessions: v2Sessions } : undefined,
        fetching: v2Result.fetching,
        error: v2Result.error,
      }
    : v1Result;

  useEffect(() => {
    // Sync fetch timestamp for UI display — intentional setState in effect
    if (result.data) {
      setLastFetchTime(Date.now());
    }
  }, [result.data]);

  useEffect(() => {
    if (result.data && onReady) {
      onReady();
    }
  }, [result.data, onReady]);

  const sessions: SessionData[] = (result.data?.sessions ?? []).map((s) => ({
    ...s,
    status: s.status as string,
    subAgents: s.subAgents.map((sa) => ({
      ...sa,
      status: sa.status as string,
      turnCount: sa.turnCount,
      subAgents: [],
    })),
  }));
  const visibleCount = sessions.length;

  const selectedSession = selectedKey
    ? sessions.flatMap((session) => [session, ...session.subAgents]).find((session) => session.key === selectedKey)
    : undefined;

  const liveSession = selectedSession
    ? {
        key: selectedSession.key,
        displayName: selectedSession.displayName,
        totalTokens: selectedSession.totalTokens,
        contextTokens: selectedSession.contextTokens,
        usagePercent: selectedSession.usagePercent,
        status: selectedSession.status,
      }
    : undefined;

  const sortOptions: { val: SortBy; label: string }[] = [
    { val: 'UPDATED_AT', label: t('sessions.recent') },
    { val: 'TOKENS_DESC', label: t('sessions.token') },
    { val: 'NAME', label: t('sessions.group') },
  ];

  return (
    <>
      <CollapsibleSection
        title={t('sessions.title')}
        badge={
          activeOnly
            ? t('sessions.filterBadge.active', { count: visibleCount })
            : t('sessions.filterBadge.all', { count: visibleCount })
        }
        updatedAt={lastFetchTime}
      >
        {/* Filter (left) + Sort (right) */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            <ToggleButton
              active={viewMode === 'active'}
              onClick={() => {
                setViewMode('active');
              }}
            >
              {t('sessions.active')}
            </ToggleButton>
            <ToggleButton
              active={viewMode === 'all'}
              onClick={() => {
                setViewMode('all');
              }}
            >
              {t('sessions.all')}
            </ToggleButton>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs mr-0.5 text-fg-dim">{t('sessions.sort')}</span>
            {sortOptions.map(({ val, label }) => (
              <ToggleButton
                key={val}
                active={sortBy === val}
                variant="sort"
                onClick={() => {
                  setSortBy(val);
                }}
              >
                {label}
              </ToggleButton>
            ))}
          </div>
        </div>

        {/* Session List */}
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionGroup
              key={s.key}
              session={s}
              onSelect={handleSelect}
              selectedKey={selectedKey}
              referenceNowMs={lastFetchTime || undefined}
            />
          ))}
          {result.fetching && !result.data && (
            <>
              <SessionSkeleton />
              <SessionSkeleton />
              <SessionSkeleton />
            </>
          )}
          {!result.fetching && sessions.length === 0 && (
            <p className="text-xs text-fg-dim">{t('sessions.noSessions')}</p>
          )}
        </div>
      </CollapsibleSection>
      {selectedKey && (
        <SessionDrawer
          key={selectedKey}
          sessionKey={selectedKey}
          onClose={handleClose}
          status={selectedSession?.status}
          displayName={selectedSession?.displayName}
          liveSession={liveSession}
        />
      )}
    </>
  );
}
