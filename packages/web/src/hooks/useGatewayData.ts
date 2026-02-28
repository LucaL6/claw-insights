import { useEffect, useRef } from 'react';

import { ChannelsQuery, GatewayQuery, ResourcesQuery } from '../graphql/queries';
import { formatUptime } from '../utils/format';
import { useConnectionStatus } from './useConnectionStatus';
import { useReactiveQuery } from './useReactiveQuery';

export type GatewayStatus = 'running' | 'gateway-down' | 'dashboard-offline' | 'connecting';

export function useGatewayData() {
  const [gw, reexecuteGateway] = useReactiveQuery(
    { query: GatewayQuery, requestPolicy: 'cache-and-network' },
    { sources: ['gateway'] },
  );
  const [res] = useReactiveQuery(
    { query: ResourcesQuery, requestPolicy: 'cache-and-network' },
    { sources: ['gateway', 'metrics'] },
  );
  const [ch] = useReactiveQuery({ query: ChannelsQuery, requestPolicy: 'cache-and-network' }, { sources: ['gateway'] });

  const connection = useConnectionStatus();

  const gateway = gw.data?.gateway;
  const resources = res.data?.resources;
  const channels = ch.data?.channels ?? [];
  const uptime = formatUptime(gateway?.startedAt);

  const fetchingGateway = gw.fetching && !gw.data;
  const fetching = {
    gateway: fetchingGateway,
    resources: res.fetching && !res.data,
    channels: ch.fetching && !ch.data,
  };

  // Priority: connecting > dashboard-offline > gateway-down > running
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

  // Fast retry with exponential backoff when gateway appears down
  const retryCount = useRef(0);
  useEffect(() => {
    if (status !== 'gateway-down') {
      retryCount.current = 0;
      return;
    }
    // 5s → 10s → 20s → 30s (capped)
    const delay = Math.min(5_000 * Math.pow(2, retryCount.current), 30_000);
    const id = setTimeout(() => {
      retryCount.current++;
      reexecuteGateway({ requestPolicy: 'network-only' });
    }, delay);
    return () => {
      clearTimeout(id);
    };
  }, [status, reexecuteGateway]);

  return { gateway, resources, channels, uptime, status, fetching };
}
