import express from 'express';
import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './schema/resolvers.js';
import { BrowserPool } from './screenshot/browser-pool.js';
import { createScreenshotHandler } from './screenshot/route.js';

const schema = createSchema({ typeDefs, resolvers });
const yoga = createYoga({ schema });
const app = express();

app.use('/graphql', yoga);

const browserPool = new BrowserPool();
app.get('/api/screenshot', createScreenshotHandler(browserPool));

// Cleanup on process exit
process.on('SIGTERM', () => browserPool.shutdown());
process.on('SIGINT', () => browserPool.shutdown());

const PORT = 4000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🦞 Dashboard API: http://127.0.0.1:${PORT}/graphql`);
});
