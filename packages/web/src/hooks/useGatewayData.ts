import { useCallback } from 'react';

import type { SystemDashboardQuery as SystemDashboardResult } from '../generated/graphql';
import { SystemDashboardQuery } from '../graphql/queries';
import { formatUptime } from '../utils/format';
import { useConnectionStatus } from './useConnectionStatus';
import { useReactiveQuery } from './useReactiveQuery';
import { useRetryWithBackoff } from './useRetryWithBackoff';

export type GatewayStatus = 'running' | 'gateway-down' | 'dashboard-offline' | 'connecting';

type OpenClawSystemPayload = NonNullable<SystemDashboardResult['system']>;

const isOpenClawSystemPayload = (value: unknown): value is OpenClawSystemPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeSystem = value as { __typename?: unknown };
  return maybeSystem.__typename === 'OpenClawSystem';
};

export function useGatewayData() {
  const [queryResult, reexecuteSystem] = useReactiveQuery(
    {
      query: SystemDashboardQuery,
      variables: { context: { trace: { requestId: 'dashboard-topbar' } } },
      requestPolicy: 'cache-and-network',
    },
    { sources: ['gateway', 'metrics'] },
  );

  const connection = useConnectionStatus();

  const systemCandidate: unknown = queryResult.data?.system;
  const openClawSystem = isOpenClawSystemPayload(systemCandidate) ? systemCandidate : null;

  const gateway = openClawSystem?.gateway;
  const resources = openClawSystem?.resources;
  const channels = openClawSystem?.channels ?? [];
  const uptime = formatUptime(gateway?.startedAt);

  const fetchingGateway = queryResult.fetching && !queryResult.data;
  const fetching = {
    gateway: fetchingGateway,
    resources: queryResult.fetching && !queryResult.data,
    channels: queryResult.fetching && !queryResult.data,
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
    reexecuteSystem({ requestPolicy: 'network-only' });
  }, [reexecuteSystem]);

  useRetryWithBackoff(status === 'gateway-down', retryGateway);

  return { gateway, resources, channels, uptime, status, fetching };
}
