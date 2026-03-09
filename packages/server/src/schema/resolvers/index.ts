import type { AppContext } from '../../context.js';
import type { Resolvers } from '../generated/resolver-types.js';
import { createSourceResolvers } from '../source/resolvers.js';
import { subscriptionResolvers } from './subscriptions.resolver.js';

type ResolverFactory = (ctx: AppContext) => Partial<Resolvers>;

const factories: ResolverFactory[] = [subscriptionResolvers, createSourceResolvers];

export function createResolvers(ctx: AppContext): Resolvers {
  const merged: Record<string, Record<string, unknown>> = {};
  for (const factory of factories) {
    const partial = factory(ctx);
    for (const [rootType, fields] of Object.entries(partial)) {
      merged[rootType] = { ...merged[rootType], ...(fields as Record<string, unknown>) };
    }
  }
  return merged as unknown as Resolvers;
}
