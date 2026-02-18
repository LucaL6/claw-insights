import { useState, useEffect, useMemo } from 'react';
import { MetricsQuery } from '../graphql/queries';
import { useReactiveQuery } from './useReactiveQuery';
import type { MetricsRange, ModelTokens } from '@claw-insights/shared';

export interface BucketData {
  bucket: number;
  label: string;
  epochStart?: number;
  sessions: number;
  tokensK: number;
  tokensByModel?: ModelTokens[];
  apiCalls: number;
  toolCalls: number;
  errors: number;
  warnings: number;
  gatewayUp: boolean;
  restartEvent: boolean;
}

export function useMetricsData(range: MetricsRange) {
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());
  const variables = useMemo(() => ({ range }), [range]);

  const [result] = useReactiveQuery(
    { query: MetricsQuery, variables, requestPolicy: 'cache-and-network' },
    { sources: ['metrics'] },
  );

  useEffect(() => {
    if (result.data) setLastFetchTime(Date.now());
  }, [result.data]);

  const metrics = result.data?.metrics;
  const buckets: BucketData[] = metrics?.buckets ?? [];

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
  const totalTokensK = buckets.reduce((s, b) => s + Number(b.tokensK ?? 0), 0);
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
    totalErrors,
    totalWarnings,
    uptimePct,
    bucketSeconds,
    lastFetchTime,
    fetching: result.fetching && !result.data,
    result,
  };
}
