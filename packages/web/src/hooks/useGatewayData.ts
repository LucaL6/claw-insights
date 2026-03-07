import { useCallback, useEffect, useRef, useState } from 'react';

import { isSchemaV2Enabled } from '../config/feature-flags';
import type { SystemDashboardV2Query as SystemDashboardV2Result } from '../generated/graphql';
import { getFallbackMode, getFallbackReasonTag, shouldFallbackToV1 } from '../graphql/fallback-policy';
import { ChannelsQuery, GatewayQuery, ResourcesQuery } from '../graphql/queries';
import { SystemDashboardV2Query } from '../graphql/queries-v2';
import { formatUptime } from '../utils/format';
import { useConnectionStatus } from './useConnectionStatus';
import { useReactiveQuery } from './useReactiveQuery';
import { useRetryWithBackoff } from './useRetryWithBackoff';

export type GatewayStatus = 'running' | 'gateway-down' | 'dashboard-offline' | 'connecting';

const TOPBAR_RETRY_WINDOW_MS = 60_000;

type OpenClawSystemPayload = SystemDashboardV2Result['system'];

const isOpenClawSystemPayload = (value: unknown): value is OpenClawSystemPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeSystem = value as { __typename?: unknown };
  return maybeSystem.__typename === 'OpenClawSystem';
};

export function useGatewayData() {
  const schemaV2Enabled = isSchemaV2Enabled();
  const [fallbackToV1, setFallbackToV1] = useState(false);

  const useV2Path = schemaV2Enabled && !fallbackToV1;

  const [v2Result, reexecuteSystemV2] = useReactiveQuery(
    {
      query: SystemDashboardV2Query,
      variables: { context: { trace: { requestId: 'dashboard-topbar' } } },
      requestPolicy: 'cache-and-network',
      pause: !useV2Path,
    },
    { sources: ['gateway', 'metrics'] },
  );

  const [gw, reexecuteGateway] = useReactiveQuery(
    { query: GatewayQuery, requestPolicy: 'cache-and-network', pause: schemaV2Enabled && !fallbackToV1 },
    { sources: ['gateway'] },
  );
  const [res] = useReactiveQuery(
    { query: ResourcesQuery, requestPolicy: 'cache-and-network', pause: schemaV2Enabled && !fallbackToV1 },
    { sources: ['gateway', 'metrics'] },
  );
  const [ch] = useReactiveQuery(
    { query: ChannelsQuery, requestPolicy: 'cache-and-network', pause: schemaV2Enabled && !fallbackToV1 },
    { sources: ['gateway'] },
  );

  const connection = useConnectionStatus();

  const systemCandidate: unknown = v2Result.data?.system;
  const systemTypeMismatch = Boolean(systemCandidate) && !isOpenClawSystemPayload(systemCandidate);
  const openClawSystem = isOpenClawSystemPayload(systemCandidate) ? systemCandidate : null;
  const systemNamespaceMissing =
    schemaV2Enabled && !fallbackToV1 && !v2Result.fetching && (!openClawSystem || systemTypeMismatch);
  const v2ShouldFallback = shouldFallbackToV1({
    surface: 'system',
    namespaceMissing: systemNamespaceMissing,
    error: v2Result.error,
  });
  const v2ReasonTag =
    systemTypeMismatch && !v2Result.error
      ? 'system-typename-mismatch'
      : getFallbackReasonTag({ surface: 'system', namespaceMissing: systemNamespaceMissing, error: v2Result.error });

  const lastTransitionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!schemaV2Enabled || fallbackToV1 || !v2ShouldFallback || !v2ReasonTag) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- fallback transition is intentionally state-driven
    setFallbackToV1(true);
  }, [schemaV2Enabled, fallbackToV1, v2ShouldFallback, v2ReasonTag]);

  useEffect(() => {
    if (!schemaV2Enabled || !v2ReasonTag) {
      return;
    }

    const mode = getFallbackMode(v2ReasonTag);
    const transitionTag = `enter:${v2ReasonTag}:${mode}`;

    if (fallbackToV1 && lastTransitionRef.current !== transitionTag) {
      lastTransitionRef.current = transitionTag;
      console.warn('[useGatewayData] fallback to v1', { reasonTag: v2ReasonTag, mode, surface: 'system' });
    }
  }, [schemaV2Enabled, fallbackToV1, v2ReasonTag]);

  useEffect(() => {
    if (!schemaV2Enabled || !fallbackToV1) {
      return;
    }

    const id = setInterval(() => {
      setFallbackToV1(false);
    }, TOPBAR_RETRY_WINDOW_MS);

    return () => {
      clearInterval(id);
    };
  }, [schemaV2Enabled, fallbackToV1]);

  const activeGatewayResult = useV2Path
    ? { data: { gateway: openClawSystem?.gateway }, fetching: v2Result.fetching }
    : gw;
  const activeResourcesResult = useV2Path
    ? { data: { resources: openClawSystem?.resources }, fetching: v2Result.fetching }
    : res;
  const activeChannelsResult = useV2Path
    ? { data: { channels: openClawSystem?.channels ?? [] }, fetching: v2Result.fetching }
    : ch;

  const gateway = activeGatewayResult.data?.gateway;
  const resources = activeResourcesResult.data?.resources;
  const channels = activeChannelsResult.data?.channels ?? [];
  const uptime = formatUptime(gateway?.startedAt);

  const fetchingGateway = activeGatewayResult.fetching && !activeGatewayResult.data;
  const fetching = {
    gateway: fetchingGateway,
    resources: activeResourcesResult.fetching && !activeResourcesResult.data,
    channels: activeChannelsResult.fetching && !activeChannelsResult.data,
  };

  let status: GatewayStatus;
  if (connection === 'connecting' || fetchingGateway) {
    status = 'connecting';
  } else if (connection === 'reconnecting') {
    status = 'dashboard-offline';
  } else if (gateway?.running) {
    status = 'running';
  } else {
    status = 'gateway-down';
  }

  const retryGateway = useCallback(() => {
    if (schemaV2Enabled && !fallbackToV1) {
      reexecuteSystemV2({ requestPolicy: 'network-only' });
      return;
    }

    reexecuteGateway({ requestPolicy: 'network-only' });
  }, [schemaV2Enabled, fallbackToV1, reexecuteSystemV2, reexecuteGateway]);

  useRetryWithBackoff(status === 'gateway-down', retryGateway);

  return { gateway, resources, channels, uptime, status, fetching };
}
