import express from 'express';
import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from './schema/typeDefs.js';
import { createResolvers } from './schema/resolvers/index.js';
import { createContext, startContext, destroyContext } from './context.js';
import { BrowserPool } from './screenshot/browser-pool.js';
import { createSnapshotHandler } from './snapshot/route.js';
import { getGatewayStatus } from './sources/gateway-cli.js';
import { queryEvents } from './db/queries.js';
import type { DataSources } from './snapshot/data-service.js';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';

const ctx = createContext();
const resolvers = createResolvers(ctx);
startContext(ctx);

const schema = createSchema({ typeDefs, resolvers });
const yoga = createYoga({ schema });
const app = express();

app.use(express.json());
app.use('/graphql', authMiddleware, yoga);

const browserPool = new BrowserPool();

const snapshotSources: DataSources = {
  getGateway: async () => {
    const s = await getGatewayStatus();
    const sys = await ctx.systemMetrics.getMetrics();
    return { ...s, cpu: sys.cpu, memoryMB: sys.memoryMB };
  },
  getChannels: async () => (await getGatewayStatus()).channels,
  getSessions: () => {
    ctx.sessionReader.attachSubAgents(ctx.spawnTracker.getParentChildMap());
    return ctx.sessionReader.getSessions();
  },
  getMetrics: (range: string) => ctx.aggregator.getMetrics(undefined, range as any),
  getRecentErrors: (limit: number) => queryEvents(ctx.db, { types: ['error', 'warning'], limit }),
};

app.post('/api/snapshot', authMiddleware, createSnapshotHandler(browserPool, snapshotSources));

// Graceful shutdown
async function shutdown() {
  destroyContext(ctx);
  await browserPool.shutdown();
  process.exit(0);
}
process.on('SIGTERM', () => { shutdown(); });
process.on('SIGINT', () => { shutdown(); });

const PORT = config.serverPort;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🦞 Dashboard API: http://127.0.0.1:${PORT}/graphql`);
});
