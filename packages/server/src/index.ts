import express from 'express';
import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './schema/resolvers.js';

const schema = createSchema({ typeDefs, resolvers });
const yoga = createYoga({ schema });
const app = express();

app.use('/graphql', yoga);

const PORT = 4000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🦞 Dashboard API: http://127.0.0.1:${PORT}/graphql`);
});
