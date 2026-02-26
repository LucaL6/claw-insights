import type { AppContext } from '../../context.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

export function lifetimeResolvers(ctx: AppContext): Partial<Resolvers> {
  const lifetimeStats: QueryResolvers['lifetimeStats'] = () => safe(async () => ctx.lifetimeScanner.getStats());

  return { Query: { lifetimeStats } };
}
