import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from '../schema/typeDefs.js';
import { createResolvers } from '../schema/resolvers/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Express } from 'express';
import type { AppContext } from '../context.js';

export function registerGraphQL(app: Express, ctx: AppContext): void {
  const resolvers = createResolvers(ctx);
  const schema = createSchema({ typeDefs, resolvers });
  const yoga = createYoga({ schema });
  app.use('/graphql', authMiddleware, yoga);
}
