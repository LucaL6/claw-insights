import type { Express } from 'express';
import { createSchema,createYoga } from 'graphql-yoga';

import type { AppContext } from '../context.js';
import { authMiddleware } from '../middleware/auth.js';
import { createResolvers } from '../schema/resolvers/index.js';
import { typeDefs } from '../schema/typeDefs.js';

export function registerGraphQL(app: Express, ctx: AppContext): void {
  const resolvers = createResolvers(ctx);
  const schema = createSchema({ typeDefs, resolvers });
  const yoga = createYoga({ schema });
  app.use('/graphql', authMiddleware, yoga);
}
