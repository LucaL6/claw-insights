// packages/web/src/hooks/useTopBarData.ts
import { GatewayQuery } from '../graphql/queries';
import { useReactiveQuery } from './useReactiveQuery';

/** App-level top bar data: version only. Gateway data moved to useGatewayData. */
export function useTopBarData() {
  const [gw] = useReactiveQuery({ query: GatewayQuery, requestPolicy: 'cache-and-network' }, { sources: ['gateway'] });

  const gateway = gw.data?.gateway;
  const version = gateway?.appVersion ?? '...';

  return {
    version,
    fetching: { gateway: gw.fetching && !gw.data },
  };
}
