import { useCallback,useEffect, useRef } from 'react';
import type { AnyVariables, UseQueryArgs, UseQueryResponse } from 'urql';
import { useQuery, useSubscription } from 'urql';

import { DataChangedSubscription } from '../graphql/subscriptions';

type DataSource = 'sessions' | 'metrics' | 'gateway';

interface ReactiveOptions {
  sources: DataSource[];
  debounceMs?: number;
  fallbackPollMs?: number;
}

export function useReactiveQuery<TData = unknown, TVariables extends AnyVariables = AnyVariables>(
  queryArgs: UseQueryArgs<TVariables, TData>,
  reactive: ReactiveOptions,
): UseQueryResponse<TData, TVariables> {
  const [result, executeQuery] = useQuery(queryArgs);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sseHealthy = useRef(true);

  const refetch = useCallback(() => {
    executeQuery({ requestPolicy: 'network-only' });
  }, [executeQuery]);

  // Subscription handler — receives DataChanged signals
  const handleSubscription = useCallback(
    (_prev: unknown, data: { dataChanged: { source: string; ts: string } }) => {
      if (!data.dataChanged) {return data;} // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- defensive: subscription data

      const { source } = data.dataChanged;
      if (!reactive.sources.includes(source as DataSource)) {return data;}

      // Debounce refetch
      if (debounceTimer.current) {clearTimeout(debounceTimer.current);}
      debounceTimer.current = setTimeout(refetch, reactive.debounceMs ?? 500);

      return data;
    },
    [reactive.sources, reactive.debounceMs, refetch],
  );

  // Track SSE by checking subscription result errors
  const [subResult] = useSubscription({ query: DataChangedSubscription }, handleSubscription);

  useEffect(() => {
    sseHealthy.current = !subResult.error;
  }, [subResult.error]);

  // Fallback poll only when SSE has actual errors
  useEffect(() => {
    const pollMs = reactive.fallbackPollMs ?? 30_000;

    const healthCheck = setInterval(() => {
      if (!sseHealthy.current) {
        refetch();
      }
    }, pollMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {refetch();}
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(healthCheck);
      if (debounceTimer.current) {clearTimeout(debounceTimer.current);}
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reactive.fallbackPollMs, refetch]);

  return [result, executeQuery];
}
