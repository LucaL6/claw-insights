import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useSubscription } from 'urql';
import type { AnyVariables, UseQueryArgs, UseQueryResponse } from 'urql';
import { DataChangedSubscription } from '../graphql/subscriptions';

type DataSource = 'sessions' | 'metrics' | 'gateway';

interface ReactiveOptions {
  sources: DataSource[];
  debounceMs?: number;
  fallbackPollMs?: number;
}

export function useReactiveQuery<T = unknown>(
  queryArgs: UseQueryArgs<AnyVariables, T>,
  reactive: ReactiveOptions,
): UseQueryResponse<T> {
  const [result, executeQuery] = useQuery(queryArgs);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const fallbackTimer = useRef<ReturnType<typeof setInterval>>();
  const sseConnected = useRef(true);

  const refetch = useCallback(() => {
    executeQuery({ requestPolicy: 'network-only' });
  }, [executeQuery]);

  // Subscription handler — receives DataChanged signals
  const handleSubscription = useCallback(
    (_prev: unknown, data: { dataChanged: { source: string; ts: string } }) => {
      if (!data?.dataChanged) return data;
      sseConnected.current = true;

      const { source } = data.dataChanged;
      if (!reactive.sources.includes(source as DataSource)) return data;

      // Debounce refetch
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(refetch, reactive.debounceMs ?? 500);

      return data;
    },
    [reactive.sources, reactive.debounceMs, refetch],
  );

  useSubscription({ query: DataChangedSubscription }, handleSubscription);

  // Fallback polling when SSE disconnects
  useEffect(() => {
    const pollMs = reactive.fallbackPollMs ?? 30_000;

    // Check SSE health every pollMs — if no signal received, start polling
    const healthCheck = setInterval(() => {
      if (!sseConnected.current) {
        refetch();
      }
      // Reset flag — if subscription is alive it will set it back to true
      sseConnected.current = false;
    }, pollMs);

    // Refetch on tab visibility change (waking from sleep)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(healthCheck);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (fallbackTimer.current) clearInterval(fallbackTimer.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reactive.fallbackPollMs, refetch]);

  return [result, executeQuery];
}
