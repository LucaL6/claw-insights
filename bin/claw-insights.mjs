#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

async function main() {
  const { parseCliArgs } = await import(
    resolve(__dirname, '..', 'packages', 'server', 'dist', 'cli', 'parse-args.js')
  );
  const args = parseCliArgs(process.argv.slice(2));

  if (args.version) {
    console.log(`claw-insights v${pkg.version}`);
    process.exit(0);
  }

  if (args.help) {
    printUsage(pkg.version);
    process.exit(0);
  }

  const serverEntry = resolve(__dirname, '..', 'packages', 'server', 'dist', 'index.js');
  if (!existsSync(serverEntry)) {
    console.error(`❌ Build not found at ${serverEntry}`);
    console.error(`   Run 'npm run build' first, or use 'npm run dev' for development.`);
    process.exit(1);
  }

  if (args.serverOnly && process.argv.includes('--web-port')) {
    console.warn('⚠️  --web-port is ignored in server-only mode.');
  }

  process.env.NODE_ENV = 'production';
  process.env.CLAW_INSIGHTS_SERVER_PORT = String(args.port);
  process.env.CLAW_INSIGHTS_WEB_PORT = String(args.webPort);
  if (args.serverOnly) process.env.CLAW_INSIGHTS_SERVER_ONLY = 'true';
  if (args.gateway) process.env.CLAW_INSIGHTS_GATEWAY = args.gateway;

  const { daemonStart, daemonStop, daemonStatus, daemonLogs, daemonRestart } = await import(
    resolve(__dirname, '..', 'packages', 'server', 'dist', 'cli', 'daemon.js')
  );

  switch (args.command) {
    case 'start':
      await daemonStart(args, serverEntry);
      break;
    case 'stop':
      daemonStop();
      break;
    case 'status':
      await daemonStatus();
      break;
    case 'logs':
      daemonLogs(args.lines);
      break;
    case 'restart':
      await daemonRestart(args, serverEntry);
      break;
    case 'run':
      await import(serverEntry);
      break;
  }
}

function printUsage(version) {
  console.log(`
  🦞 Claw Insights v${version}

  Usage:
    claw-insights [options]              Run in foreground (server + web)
    claw-insights start [options]        Start as daemon
    claw-insights stop                   Stop daemon
    claw-insights status                 Show daemon status
    claw-insights logs [--lines N]       View daemon logs
    claw-insights restart [options]      Restart daemon

  Options:
    --port <port>         Server port (default: 4000)
    --web-port <port>     Web UI port (default: 3200)
    --server-only         Run server only (no web UI)
    --gateway <url>       OpenClaw gateway URL
    --log-dir <dir>       Log directory
    --help, -h            Show this help
    --version, -v         Show version
  `.trim());
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
