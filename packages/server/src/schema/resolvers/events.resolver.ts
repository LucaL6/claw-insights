import type { AppContext } from '../../context.js';
import { getEventCounts, getEventDensity, queryEvents } from '../../db/event-queries.js';
import type { QueryResolvers,Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

export function eventsResolvers(ctx: AppContext): Partial<Resolvers> {
  const { db } = ctx;

  const events: QueryResolvers['events'] = (_parent, args) =>
    safe(() =>
      Promise.resolve(queryEvents(db, {
        from: args.from ?? undefined,
        to: args.to ?? undefined,
        types: args.types ?? undefined,
        limit: args.limit ?? undefined,
      })),
    );

  const eventDensity: QueryResolvers['eventDensity'] = () => safe(() => Promise.resolve(getEventDensity(db)));

  const eventCounts: QueryResolvers['eventCounts'] = (_parent, args) =>
    safe(() =>
      Promise.resolve(getEventCounts(db, {
        from: args.from ?? undefined,
        to: args.to ?? undefined,
      })),
    );

  return { Query: { events, eventDensity, eventCounts } };
}
