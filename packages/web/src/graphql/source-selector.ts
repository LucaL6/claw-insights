import type { SourceSelector } from '../generated/graphql';

export const getDashboardSourceSelector = (): SourceSelector => ({
  id: 'agent:main',
});
