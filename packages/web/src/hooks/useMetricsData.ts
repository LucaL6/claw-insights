import type { MetricsRange, ModelTokens } from '@claw-insights/shared';
import { useEffect, useMemo, useState } from 'react';

import { MetricsQuery } from '../graphql/queries';
import { getDashboardSourceSelector } from '../graphql/source-selector';
import { useReactiveQuery } from './useReactiveQuery';

export interface BucketData {
  bucket: number;
  label: string;
  epochStart?: number;
  sessions: number;
  tokensK: number;
  tokensByModel?: ModelTokens[];
  apiCalls: number;
  toolCalls: number;
  turns: number;
  userTurns: number;
  assistantTurns: number;
  errors: number;
  warnings: number;
  gatewayUp: boolean;
  restartEvent: boolean;
}

export function useMetricsData(range: MetricsRange) {
  const [lastFetchTime, setLastFetchTime] = useState(() => Date.now());

  const selector = getDashboardSourceSelector();

  const selectorKey = JSON.stringify(selector);

  const variables = useMemo(
    () => ({
      selector,
      context: { trace: { requestId: 'dashboard-metrics' } },
      range,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectorKey is stable serialization
    [selectorKey, range],
  );

  const [result] = useReactiveQuery(
    {
      query: MetricsQuery,
      variables,
      requestPolicy: 'cache-and-network',
    },
    { sources: ['metrics'] },
  );

  const agentNamespace = result.data?.source ?? null;
  const metrics = agentNamespace?.metrics;

  useEffect(() => {
    if (result.data) {
      setLastFetchTime(Date.now());
    }
  }, [result.data]);

  const buckets: BucketData[] = useMemo(() => metrics?.buckets ?? [], [metrics?.buckets]);

  const allModels = useMemo(() => {
    const modelSet = new Set<string>();
    for (const b of buckets) {
      for (const mt of b.tokensByModel ?? []) {
        modelSet.add(mt.model);
      }
    }
    return Array.from(modelSet).sort();
  }, [buckets]);

  const peakSessions = buckets.length > 0 ? Math.max(...buckets.map((b) => b.sessions)) : 0;
  const totalTokensK = buckets.reduce((s, b) => s + b.tokensK, 0);
  const totalMessages = metrics?.totalTurns ?? 0;
  const totalErrors = metrics?.totalErrors ?? 0;
  const totalWarnings = metrics?.totalWarnings ?? 0;
  const uptimePct = metrics?.uptimePercent ?? 0;
  const bucketSeconds = (metrics?.bucketMinutes ?? 60) * 60;

  return {
    metrics,
    buckets,
    allModels,
    peakSessions,
    totalTokensK,
    totalMessages,
    totalErrors,
    totalWarnings,
    uptimePct,
    bucketSeconds,
    lastFetchTime,
    fetching: result.fetching && !result.data,
    result,
  };
}
