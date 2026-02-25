import { ChannelsQuery, GatewayQuery, ResourcesQuery } from '../graphql/queries';
import { formatUptime } from '../utils/format';
import { useReactiveQuery } from './useReactiveQuery';

export type GatewayStatus = 'running' | 'down' | 'connecting';

export function useGatewayData() {
  const [gw] = useReactiveQuery({ query: GatewayQuery, requestPolicy: 'cache-and-network' }, { sources: ['gateway'] });
  const [res] = useReactiveQuery(
    { query: ResourcesQuery, requestPolicy: 'cache-and-network' },
    { sources: ['gateway', 'metrics'] },
  );
  const [ch] = useReactiveQuery({ query: ChannelsQuery, requestPolicy: 'cache-and-network' }, { sources: ['gateway'] });

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

  let status: GatewayStatus;
  if (fetchingGateway) {
    status = 'connecting';
  } else if (gateway?.running) {
    status = 'running';
  } else {
    status = 'down';
  }

  return { gateway, resources, channels, uptime, status, fetching };
}
