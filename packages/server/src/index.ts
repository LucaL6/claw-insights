import express from 'express';
import { createContext, startContext, destroyContext } from './context.js';
import { BrowserPool } from './browser/browser-pool.js';
import { registerGraphQL } from './routes/graphql.js';
import { registerSnapshot } from './routes/snapshot.js';
import { config } from './config.js';

const ctx = createContext();
startContext(ctx);

const app = express();
app.use(express.json());

const browserPool = new BrowserPool();

registerGraphQL(app, ctx);
registerSnapshot(app, ctx, browserPool);

// Graceful shutdown
async function shutdown() {
  destroyContext(ctx);
  await browserPool.shutdown();
  process.exit(0);
}
process.on('SIGTERM', () => {
  shutdown();
});
process.on('SIGINT', () => {
  shutdown();
});

const PORT = config.serverPort;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🦞 Dashboard API: http://127.0.0.1:${PORT}/graphql`);
});
