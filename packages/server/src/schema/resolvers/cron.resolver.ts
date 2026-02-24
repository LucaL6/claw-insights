import type { AppContext } from '../../context.js';
import type { QueryResolvers,Resolvers } from '../generated/resolver-types.js';

export function cronResolvers(ctx: AppContext): Partial<Resolvers> {
  const cronJobs: QueryResolvers['cronJobs'] = () => ctx.cronReader.getJobs();
  return { Query: { cronJobs } };
}
