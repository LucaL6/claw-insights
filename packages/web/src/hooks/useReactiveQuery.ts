import { useCallback, useEffect, useRef } from 'react';
import type { AnyVariables, UseQueryArgs, UseQueryResponse } from 'urql';
import { useQuery, useSubscription } from 'urql';

import { DataChangedSubscription } from '../graphql/subscriptions';
import { connectionHealth } from '../lib/connection-health';

type DataSource = 'sessions' | 'metrics' | 'gateway';

interface ReactiveOptions {
  sources: DataSource[];
  debounceMs?: number;
  fallbackPollMs?: number;
}

// Module-level counter for unique instance keys
let instanceCounter = 0;

export function useReactiveQuery<TData = unknown, TVariables extends AnyVariables = AnyVariables>(
  queryArgs: UseQueryArgs<TVariables, TData>,
  reactive: ReactiveOptions,
): UseQueryResponse<TData, TVariables> {
  const [result, executeQuery] = useQuery(queryArgs);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sseHealthy = useRef(true);

  // Stable instance-unique key
  const sseKey = useRef(`rq-${++instanceCounter}`);

  const refetch = useCallback(() => {
    executeQuery({ requestPolicy: 'network-only' });
  }, [executeQuery]);

  // Stabilize sources as a string key — callers pass inline array literals,
  // so the raw array ref changes every render.
  const sourcesKey = reactive.sources.join(',');

  const handleSubscription = useCallback(
    (_prev: unknown, data: { dataChanged: { source: string; ts: string } }) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime: initial subscription push may omit dataChanged
      if (!data.dataChanged) {
        return data;
      }

      const { source } = data.dataChanged;
      if (!sourcesKey.split(',').includes(source)) {
        return data;
      }

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(refetch, reactive.debounceMs ?? 500);

      return data;
    },
    [sourcesKey, reactive.debounceMs, refetch],
  );

  const [subResult] = useSubscription({ query: DataChangedSubscription }, handleSubscription);

  // Report SSE health
  useEffect(() => {
    const healthy = !subResult.error;
    sseHealthy.current = healthy;
    connectionHealth.reportSseHealth(sseKey.current, healthy);
  }, [subResult.error]);

  // Cleanup SSE entry on unmount
  useEffect(() => {
    const key = sseKey.current;
    return () => {
      connectionHealth.unregisterSse(key);
    };
  }, []);

  // Report fetch health
  useEffect(() => {
    if (result.error) {
      connectionHealth.reportFetchFailure();
    } else if (result.data && !result.fetching) {
      connectionHealth.reportFetchSuccess();
    }
  }, [result.data, result.error, result.fetching]);

  // Fallback poll only when SSE has actual errors
  useEffect(() => {
    const pollMs = reactive.fallbackPollMs ?? 30_000;

    const healthCheck = setInterval(() => {
      if (!sseHealthy.current) {
        refetch();
      }
    }, pollMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(healthCheck);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reactive.fallbackPollMs, refetch]);

  return [result, executeQuery];
}
