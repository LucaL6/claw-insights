// packages/web/src/hooks/useTopBarData.ts
import type { SystemDashboardQuery as SystemDashboardResult } from '../generated/graphql';
import { SystemDashboardQuery } from '../graphql/queries';
import { useReactiveQuery } from './useReactiveQuery';

type OpenClawSystemPayload = NonNullable<SystemDashboardResult['system']>;

const isOpenClawSystemPayload = (value: unknown): value is OpenClawSystemPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (value as { __typename?: unknown }).__typename === 'OpenClawSystem';
};

/** App-level top bar data: version only. Gateway data moved to useGatewayData. */
export function useTopBarData() {
  const [result] = useReactiveQuery(
    {
      query: SystemDashboardQuery,
      variables: { context: { trace: { requestId: 'dashboard-topbar' } } },
      requestPolicy: 'cache-and-network',
    },
    { sources: ['gateway'] },
  );

  const systemCandidate: unknown = result.data?.system;
  const openClawSystem = isOpenClawSystemPayload(systemCandidate) ? systemCandidate : null;
  const version = openClawSystem?.gateway.appVersion ?? '...';

  return {
    version,
    fetching: { gateway: result.fetching && !result.data },
  };
}
