import express from 'express';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, startContext, destroyContext } from './context.js';
import { BrowserPool } from './browser/browser-pool.js';
import { registerGraphQL } from './routes/graphql.js';
import { registerSnapshot } from './routes/snapshot.js';
import { createHealthHandler } from './routes/health.js';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ctx = createContext();
startContext(ctx);

const app = express();
app.use(express.json());

const browserPool = new BrowserPool();

registerGraphQL(app, ctx);
registerSnapshot(app, ctx, browserPool);

// Health check — no auth, no GraphQL dependency
app.get(
  '/health',
  createHealthHandler({
    version: process.env.npm_package_version ?? '0.0.0',
    serverOnly: config.serverOnly,
    checkGateway: async () => {
      try {
        const { getGatewayStatus } = await import('./sources/gateway-cli.js');
        const status = await getGatewayStatus();
        return status.running;
      } catch {
        return false;
      }
    },
    checkDb: () => {
      try {
        ctx.db.exec('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
  }),
);

// Serve web UI static files in production (release package layout)
const webDistPath = resolve(__dirname, '..', 'web');
if (!config.isDev && !config.serverOnly && existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  // SPA fallback — serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/graphql') || req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(resolve(webDistPath, 'index.html'));
  });
}

// PID file path for daemon mode cleanup
const pidPath = join(process.env.HOME ?? '/tmp', '.claw-insights', 'claw-insights.pid');

// Graceful shutdown
async function shutdown() {
  destroyContext(ctx);
  await browserPool.shutdown();
  // Clean up PID file if we are the daemon process
  try {
    if (existsSync(pidPath)) {
      const recorded = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      if (recorded === process.pid) {
        unlinkSync(pidPath);
      }
    }
  } catch {
    // best effort
  }
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
