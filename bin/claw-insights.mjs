#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

async function main() {
  // Early detect 'snapshot' subcommand — handled separately, doesn't need full server
  if (process.argv[2] === 'snapshot') {
    const { runSnapshotCmd } = await import(
      resolve(__dirname, '..', 'packages', 'server', 'dist', 'cli', 'snapshot-cmd.js')
    );
    await runSnapshotCmd(process.argv.slice(3));
    return;
  }

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

  const runtimeHelperPath = resolve(__dirname, '..', 'packages', 'server', 'dist', 'cli', 'node-runtime.js');
  // RUNTIME_POLICY_BLOCK_START
  const { buildNodeArgsForServer, assertSupportedNodeVersion } = await import(runtimeHelperPath);
  assertSupportedNodeVersion(process.versions.node);
  const nodeArgs = buildNodeArgsForServer(serverEntry, process.versions.node);
  // RUNTIME_POLICY_BLOCK_END

  if (args.serverOnly && process.argv.includes('--web-port')) {
    console.warn('⚠️  --web-port is ignored in server-only mode.');
  }

  if (args.serverOnly && args.open) {
    console.warn('⚠️  --open is ignored in server-only mode.');
  }

  process.env.NODE_ENV = 'production';
  process.env.CLAW_INSIGHTS_SERVER_PORT = String(args.port);
  process.env.CLAW_INSIGHTS_WEB_PORT = String(args.webPort);
  if (args.serverOnly) process.env.CLAW_INSIGHTS_SERVER_ONLY = 'true';
  if (args.noAuth) process.env.CLAW_INSIGHTS_NO_AUTH = 'true';
  // Support CLAW_INSIGHTS_OPEN env var as equivalent to --open
  if (!args.open && process.env.CLAW_INSIGHTS_OPEN === 'true') {
    args.open = true;
  }
  if (args.open) process.env.CLAW_INSIGHTS_OPEN = 'true';
  if (args.gateway) process.env.CLAW_INSIGHTS_GATEWAY = args.gateway;

  const { daemonStart, daemonStop, daemonStatus, daemonLogs, daemonRestart } = await import(
    resolve(__dirname, '..', 'packages', 'server', 'dist', 'cli', 'daemon.js')
  );

  switch (args.command) {
    case 'start':
      await daemonStart(args, serverEntry);
      break;
    case 'stop':
      await daemonStop();
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
      if (nodeArgs.length > 1) {
        await runForegroundChild(process.execPath, nodeArgs);
        break;
      }
      await import(serverEntry);
      break;
  }
}

async function runForegroundChild(execPath, args) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(execPath, args, { stdio: 'inherit', env: process.env });
    child.on('error', rejectPromise);
    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code ?? 0;
      resolvePromise(code ?? 0);
    });
  });
}

function printUsage(version) {
  console.log(`
  🦞 Claw Insights v${version}

  Usage:
    claw-insights start [options]        Start as daemon
    claw-insights stop                   Stop daemon
    claw-insights status                 Show daemon status
    claw-insights logs [--lines N]       View daemon logs
    claw-insights restart [options]      Restart daemon
    claw-insights snapshot [options]     Take a snapshot (see below)

  Server Options:
    --port <port>         Server port (default: 41041)
    --server-only         Run server only (no web UI)
    --no-auth             Disable authentication (local/trusted network)
    --open                Open dashboard in browser after start
    --gateway <url>       OpenClaw gateway URL
    --log-dir <dir>       Log directory
    --help, -h            Show this help
    --version, -v         Show version

  Snapshot Options:
    --format <fmt>        Output format: png, svg, json (default: png)
    --detail <level>      Detail level: compact, standard, full (default: standard)
    --range <range>       Time range: 1h, 6h, 12h, 24h (default: 6h)
    --theme <theme>       Theme: dark, light (default: dark)
    --quick               Shorthand for --detail compact --layout mobile
    --dry-run             Print parameters without executing
    -o, --output <file>   Save to file
    --token <token>       Auth token (auto-detected from ~/.claw-insights/auth-token)
    --port <port>         Server port to connect to (default: 41041)
  `.trim());
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
