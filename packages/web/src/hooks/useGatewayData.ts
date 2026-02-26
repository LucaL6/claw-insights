import { ChannelsQuery, GatewayQuery, ResourcesQuery } from '../graphql/queries';
import { formatUptime } from '../utils/format';
import { useConnectionStatus } from './useConnectionStatus';
import { useReactiveQuery } from './useReactiveQuery';

export type GatewayStatus = 'running' | 'gateway-down' | 'dashboard-offline' | 'connecting';

export function useGatewayData() {
  const [gw] = useReactiveQuery({ query: GatewayQuery, requestPolicy: 'cache-and-network' }, { sources: ['gateway'] });
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

  return { gateway, resources, channels, uptime, status, fetching };
}
