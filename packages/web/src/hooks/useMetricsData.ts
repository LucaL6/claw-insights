import type { MetricsRange, ModelTokens } from '@claw-insights/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { isSchemaV2Enabled } from '../config/feature-flags';
import {
  type FallbackReasonTag,
  getFallbackMode,
  getFallbackReasonTag,
  shouldFallbackToV1,
} from '../graphql/fallback-policy';
import { MetricsQuery } from '../graphql/queries';
import { MetricsV2Query } from '../graphql/queries-v2';
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
  const schemaV2Enabled = isSchemaV2Enabled();
  const [fallbackToV1, setFallbackToV1] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(() => Date.now());

  const selector = getDashboardSourceSelector();
  const useV2Path = schemaV2Enabled && !fallbackToV1;

  // Reset fallback when range or selector changes
  const selectorKey = JSON.stringify(selector);
  useEffect(() => {
    setFallbackToV1(false);
  }, [range, selectorKey]);

  const v2Variables = useMemo(
    () => ({
      selector,
      context: { trace: { requestId: 'dashboard-metrics' } },
      range,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectorKey is stable serialization
    [selectorKey, range],
  );

  const [v2Result] = useReactiveQuery(
    {
      query: MetricsV2Query,
      variables: v2Variables,
      requestPolicy: 'cache-and-network',
      pause: !useV2Path,
    },
    { sources: ['metrics'] },
  );

  const v1Variables = useMemo(() => ({ range }), [range]);
  const [v1Result] = useReactiveQuery(
    {
      query: MetricsQuery,
      variables: v1Variables,
      requestPolicy: 'cache-and-network',
      pause: useV2Path,
    },
    { sources: ['metrics'] },
  );

  // Fallback detection
  const agentNamespace = v2Result.data?.source ?? null;
  const sourceNullMissing = schemaV2Enabled && !fallbackToV1 && !v2Result.fetching && !agentNamespace;
  const v2ShouldFallback = shouldFallbackToV1({
    surface: 'source',
    namespaceMissing: sourceNullMissing,
    error: v2Result.error,
  });
  const v2ReasonTag = getFallbackReasonTag({
    surface: 'source',
    namespaceMissing: sourceNullMissing,
    error: v2Result.error,
  });

  const lastTransitionRef = useRef<string | null>(null);
  const pendingReasonRef = useRef<FallbackReasonTag | null>(null);

  useEffect(() => {
    if (!schemaV2Enabled || fallbackToV1 || !v2ShouldFallback || !v2ReasonTag) {
      return;
    }
    pendingReasonRef.current = v2ReasonTag;

    setFallbackToV1(true);
  }, [schemaV2Enabled, fallbackToV1, v2ShouldFallback, v2ReasonTag]);

  useEffect(() => {
    if (!schemaV2Enabled || !fallbackToV1) {
      return;
    }

    const reasonTag = pendingReasonRef.current;
    if (!reasonTag) {
      return;
    }

    const mode = getFallbackMode(reasonTag);
    const transitionTag = `enter:${reasonTag}:${mode}`;

    if (lastTransitionRef.current !== transitionTag) {
      lastTransitionRef.current = transitionTag;
      console.warn('[useMetricsData] fallback to v1', { reasonTag, mode, surface: 'source' });
    }
  }, [schemaV2Enabled, fallbackToV1]);

  // Pick active result
  const metrics = useV2Path ? agentNamespace?.metrics : v1Result.data?.metrics;
  const activeFetching = useV2Path ? v2Result.fetching : v1Result.fetching;
  const activeData = useV2Path ? v2Result.data : v1Result.data;

  useEffect(() => {
    if (activeData) {
      setLastFetchTime(Date.now());
    }
  }, [activeData]);

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
    fetching: activeFetching && !activeData,
    result: useV2Path ? v2Result : v1Result,
  };
}
