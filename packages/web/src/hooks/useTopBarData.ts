import { GatewayQuery, ResourcesQuery, ChannelsQuery } from '../graphql/queries';
import { useReactiveQuery } from './useReactiveQuery';
import { formatUptime } from '../utils/format';

export function useTopBarData() {
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
  const version = gateway?.version ?? '...';
  const latestVersion = gateway?.latestVersion as string | null;
  const updateLabel = latestVersion
    ? latestVersion.startsWith(version.slice(0, -2))
      ? '.' + latestVersion.split('.').pop()
      : latestVersion
    : null;

  return {
    gateway,
    resources,
    channels,
    uptime,
    version,
    updateLabel,
    fetching: {
      gateway: gw.fetching && !gw.data,
      resources: res.fetching && !res.data,
      channels: ch.fetching && !ch.data,
    },
  };
}
