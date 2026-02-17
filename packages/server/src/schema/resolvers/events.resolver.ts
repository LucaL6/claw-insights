import type { AppContext } from '../../context.js';
import type { Resolvers, QueryResolvers } from '../generated/resolver-types.js';
import { queryEvents, getEventDensity } from '../../db/queries.js';
import { safe } from './utils.js';

export function eventsResolvers(ctx: AppContext): Partial<Resolvers> {
  const { db } = ctx;

  const events: QueryResolvers['events'] = (_parent, args) =>
    safe(async () =>
      queryEvents(db, {
        from: args.from ?? undefined,
        to: args.to ?? undefined,
        types: args.types ?? undefined,
        limit: args.limit ?? undefined,
      }),
    );

  const eventDensity: QueryResolvers['eventDensity'] = () =>
    safe(async () => getEventDensity(db));

  return { Query: { events, eventDensity } };
}
