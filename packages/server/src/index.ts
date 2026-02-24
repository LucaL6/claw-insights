import express from 'express';
import { existsSync, readFileSync, writeFileSync, unlinkSync, chmodSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, startContext, destroyContext } from './context.js';
import { registerGraphQL } from './routes/graphql.js';
import { registerSnapshot } from './routes/snapshot.js';
import { createHealthHandler } from './routes/health.js';
import { config, generateToken, setApiToken } from './config.js';
import { cookieExchangeMiddleware } from './middleware/cookie-exchange.js';
import { createChildLogger } from './logger.js';

const log = createChildLogger('server');

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Startup preflight (BUG-024) ---
{
  const issues: string[] = [];

  // CLI reachability
  if (config.cliPath !== 'openclaw' && !existsSync(config.cliPath)) {
    issues.push(
      `⚠️  OpenClaw CLI not found at: ${config.cliPath}\n` +
        `   Set CLAW_INSIGHTS_CLI or use --cli-path to specify the correct path.\n` +
        `   Install OpenClaw: https://openclaw.ai`,
    );
  } else {
    // Verify CLI is actually callable (covers bare 'openclaw' in PATH)
    try {
      execFileSync(config.cliPath, ['--version'], { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
    } catch {
      issues.push(
        `⚠️  OpenClaw CLI found at: ${config.cliPath} but not responding.\n` +
          `   Is OpenClaw installed correctly? https://openclaw.ai`,
      );
    }
  }

  if (issues.length > 0) {
    console.log('\n🔍 Startup checks:\n');
    issues.forEach((i) => console.log(i));
    console.log('\n   Dashboard will start but may show incomplete data.\n');
  }
}

const ctx = createContext();
startContext(ctx);

// Token auto-generation (when auth enabled and no token configured)
if (!config.noAuth && !config.apiToken) {
  setApiToken(generateToken());
}

const app = express();
app.use(express.json());

// Cookie exchange (must be before auth middleware / static files)
app.use(cookieExchangeMiddleware);

registerGraphQL(app, ctx);
registerSnapshot(app, ctx);

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

// Serve web UI static files in production
// Release package: <root>/web/  |  Monorepo build: <root>/packages/web/dist/
const releaseWebPath = resolve(__dirname, '..', 'web');
const monorepoWebPath = resolve(__dirname, '..', '..', '..', 'packages', 'web', 'dist');
const webDistPath = existsSync(releaseWebPath) ? releaseWebPath : monorepoWebPath;
if (!config.isDev && !config.serverOnly && !existsSync(webDistPath)) {
  log.warn({ releaseWebPath, monorepoWebPath }, 'web UI dist not found — running API-only');
}
if (!config.isDev && !config.serverOnly && existsSync(webDistPath)) {
  log.info({ webDistPath }, 'serving web UI');
  app.use(express.static(webDistPath, { index: 'index.html' }));
  // SPA fallback — serve index.html for non-API, non-file routes
  const serveIndex = (_req: express.Request, res: express.Response) => {
    res.type('html').send(readFileSync(resolve(webDistPath, 'index.html'), 'utf-8'));
  };
  app.get('/', serveIndex);
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/graphql') || req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    // Don't serve index.html for requests with file extensions (e.g. /foo.js, /bar.css)
    if (extname(req.path)) {
      return next();
    }
    serveIndex(req, res);
  });
}

// PID file path for daemon mode cleanup
const pidPath = join(process.env.HOME ?? '/tmp', '.claw-insights', 'claw-insights.pid');

// Graceful shutdown
async function shutdown() {
  destroyContext(ctx);
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

// Pre-warm gateway status cache for faster first snapshot
import('./sources/gateway-cli.js').then((m) => m.warmCache()).catch(() => {});

const PORT = config.serverPort;
const server = app.listen(PORT, '127.0.0.1', () => {
  log.info({ port: PORT }, 'Dashboard API started');
  if (!config.isDev && config.noAuth) {
    log.warn('Running in production with auth disabled (--no-auth). This is not recommended.');
  }
  if (config.noAuth) {
    console.log(`⚠️  Auth disabled. Web UI and API are open.`);
    console.log(`💡 http://127.0.0.1:${PORT}/`);
  } else {
    const tokenUrl = `http://127.0.0.1:${PORT}/?token=${config.apiToken}`;
    if (process.stderr.isTTY) {
      // Interactive terminal — print directly
      process.stderr.write(`🔑 ${tokenUrl}\n`);
    } else {
      // Daemon mode — write token to file (user-only readable), print hint
      try {
        const dataDir = join(process.env.HOME ?? '/tmp', '.claw-insights');
        mkdirSync(dataDir, { recursive: true });
        const tokenFile = join(dataDir, 'auth-token');
        writeFileSync(tokenFile, config.apiToken, { mode: 0o600 });
        chmodSync(tokenFile, 0o600);
      } catch {
        // best-effort
      }
      console.log(`🔒 Auth enabled. Run 'claw-insights status' to get the access URL.`);
    }
  }
});

// BUG-027: Friendly port conflict message
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.\n`);
    console.error(`   Try a different port:`);
    console.error(`     claw-insights start --port ${PORT + 1}\n`);
    console.error(`   Or find what's using it:`);
    console.error(`     lsof -i :${PORT}\n`);
    process.exit(1);
  }
  throw err;
});
