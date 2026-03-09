import { spawn } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { createChildLogger } from '../logger.js';
import { reclaimLayeredLogs } from './log-rotate.js';
import type { CliArgs } from './parse-args.js';
import { PidFile } from './pid.js';

const log = createChildLogger('cli:daemon');

const HOME = process.env.HOME ?? '/tmp';

/* ── CLI Spinner ── */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const IS_INTERACTIVE = process.stdout.isTTY && !process.env.CI;

function createSpinner(message: string) {
  let stopped = false;
  if (!IS_INTERACTIVE) {
    // Non-TTY / CI: plain log, no animation
    console.log(`  ${message}`);
    return {
      update(_msg: string) {
        /* no-op in non-TTY */
      },
      stop(finalMessage: string) {
        if (!stopped) {
          stopped = true;
          console.log(`  ${finalMessage}`);
        }
      },
    };
  }
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\x1b[2K\r  ${SPINNER_FRAMES[i++ % SPINNER_FRAMES.length]} ${message}`);
  }, 80);
  timer.unref();
  return {
    update(msg: string) {
      message = msg;
    },
    stop(finalMessage: string) {
      if (stopped) {
        return;
      }
      stopped = true;
      clearInterval(timer);
      process.stdout.write(`\x1b[2K\r  ${finalMessage}\n`);
    },
  };
}

export function getDataDir(): string {
  return join(HOME, '.claw-insights');
}

export function getDaemonPaths() {
  const dataDir = getDataDir();
  return {
    dataDir,
    pidFile: join(dataDir, 'claw-insights.pid'),
    logDir: join(dataDir, 'logs'),
    daemonJson: join(dataDir, 'daemon.json'),
  };
}

const SERVER_LOG_RE = /^server\.log(\.\d+)?$/;

export function cleanupLegacyServerLogs(logDir: string): number {
  if (!existsSync(logDir)) {
    return 0;
  }
  let removed = 0;
  for (const name of readdirSync(logDir)) {
    if (SERVER_LOG_RE.test(name)) {
      try {
        unlinkSync(join(logDir, name));
        removed++;
      } catch {
        /* best effort */
      }
    }
  }
  if (removed > 0) {
    log.info({ logDir, removed }, 'cleaned up legacy server.log files');
  }
  return removed;
}

interface LayeredSegment {
  stream: 'app' | 'error' | 'debug' | 'noise' | 'security';
  date: string;
  seq: number;
  path: string;
}

const LAYERED_SEGMENT_RE = /^(app|error|debug|noise|security)\.(\d{4}-\d{2}-\d{2})\.(\d+)\.log$/;

function parseLayeredSegment(logDir: string, fileName: string): LayeredSegment | null {
  const m = LAYERED_SEGMENT_RE.exec(fileName);
  if (!m) {
    return null;
  }

  const seq = Number.parseInt(m[3] ?? '', 10);
  if (!Number.isFinite(seq)) {
    return null;
  }

  return {
    stream: m[1] as LayeredSegment['stream'],
    date: m[2],
    seq,
    path: join(logDir, fileName),
  };
}

export function selectDefaultLayeredLogFiles(logDir: string): string[] {
  if (!existsSync(logDir)) {
    return [];
  }

  const latestByStream = new Map<LayeredSegment['stream'], LayeredSegment>();
  const all = readdirSync(logDir);
  for (const name of all) {
    const seg = parseLayeredSegment(logDir, name);
    if (!seg) {
      continue;
    }
    if (seg.stream === 'debug') {
      continue;
    } // default view: error + app

    const existing = latestByStream.get(seg.stream);
    if (!existing) {
      latestByStream.set(seg.stream, seg);
      continue;
    }

    if (seg.date > existing.date || (seg.date === existing.date && seg.seq > existing.seq)) {
      latestByStream.set(seg.stream, seg);
    }
  }

  return ['error', 'app']
    .map((stream) => latestByStream.get(stream as LayeredSegment['stream'])?.path)
    .filter((v): v is string => Boolean(v));
}

export async function daemonStart(args: CliArgs, serverEntry: string): Promise<void> {
  const paths = getDaemonPaths();
  const pidFile = new PidFile(paths.pidFile);

  // If already running, auto-restart with the new build
  if (pidFile.isAlive()) {
    const pid = pidFile.read();
    console.log('');
    console.log(`  ⚠️  Claw Insights is already running (PID ${pid ?? '?'}). Restarting...`);
    await daemonStop();
  }

  // Clean stale PID
  pidFile.cleanStale();

  const startTime = Date.now();

  // Ensure directories
  mkdirSync(paths.logDir, { recursive: true });

  // Unified reclaim path for layered segments.
  await reclaimLayeredLogs(paths.logDir, { retentionDays: 14, graceHours: 1 });

  cleanupLegacyServerLogs(paths.logDir);

  // Save daemon config for restart (full snapshot + explicit tracking)
  const explicitKeys: string[] = [];
  if (args.portExplicit) {
    explicitKeys.push('port');
  }
  if (args.webPortExplicit) {
    explicitKeys.push('webPort');
  }
  writeFileSync(
    paths.daemonJson,
    JSON.stringify(
      {
        port: args.port,
        webPort: args.webPort,
        serverOnly: args.serverOnly,
        noAuth: args.noAuth,
        gateway: args.gateway,
        logDir: args.logDir,
        _explicit: explicitKeys,
      },
      null,
      2,
    ),
  );

  // Build env for child
  const childEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'production',
    CLAW_INSIGHTS_SERVER_PORT: String(args.port),
    CLAW_INSIGHTS_WEB_PORT: String(args.webPort),
  };

  if (args.serverOnly) {
    childEnv.CLAW_INSIGHTS_SERVER_ONLY = 'true';
  }
  if (args.noAuth) {
    childEnv.CLAW_INSIGHTS_NO_AUTH = 'true';
  }
  if (args.gateway) {
    childEnv.CLAW_INSIGHTS_GATEWAY = args.gateway;
  }

  // Spawn detached child (layered runtime persists operational logs).
  const child = spawn(process.execPath, [serverEntry], {
    detached: true,
    stdio: 'ignore',
    env: childEnv,
  });

  // Keep ref during startup to detect early crashes, unref after health check
  if (!child.pid) {
    console.error('❌ Failed to start daemon.');
    process.exit(1);
  }

  // Write PID file
  try {
    log.debug({ pid: child.pid, path: paths.pidFile }, 'writing PID file');
    pidFile.write(child.pid);
  } catch (err) {
    log.error({ err, pid: child.pid }, 'failed to write PID file');
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Failed to write PID file: ${msg}`);
    try {
      process.kill(child.pid, 'SIGKILL');
    } catch {
      /* best effort */
    }
    process.exit(1);
  }

  // Detach child so parent can exit after startup check
  child.unref();

  // Wait silently for health check before printing status

  const ready = await waitForHealth(args.port, 5000, () => !pidFile.isAlive());

  // Check if child died during startup (port conflict, crash, etc.)
  if (!pidFile.isAlive()) {
    pidFile.remove();
    console.log('  ❌ Failed to start — server exited immediately.');
    console.log('');
    const hints = readRecentLayeredErrorHints(paths.logDir, 8);
    if (hasPortConflictHint(hints)) {
      console.log(`  Reason: Port ${args.port} is already in use.`);
      console.log('');
      console.log('  Try:');
      console.log(`    claw-insights start --port ${args.port + 1}    # Use a different port`);
      console.log(`    claw-insights stop                       # Stop existing instance first`);
    } else if (hints.length > 0) {
      console.log('  Last error output:');
      hints.slice(-3).forEach((l) => {
        console.log(`    ${l}`);
      });
    }
    console.log('');
    console.log('  Logs: claw-insights logs --lines 30');
    console.log('');
    process.exit(1);
  }

  if (!ready) {
    console.log('  ⚠️  Server started but did not respond within 5 seconds.');
    console.log('');
    console.log(`  PID:  ${child.pid}`);
    console.log(`  Port: ${args.port}`);
    console.log('');
    console.log('  It may still be initializing. Check:');
    console.log('    claw-insights status    # Check if server is up');
    console.log('    claw-insights logs      # View server logs');
    console.log('');
    return;
  }

  // Success — print full status
  const mode = args.serverOnly ? 'API only' : 'Dashboard + API';

  let url: string;
  let authLine: string;

  if (args.noAuth) {
    url = `http://127.0.0.1:${args.port}`;
    authLine = 'Auth disabled';
  } else {
    url = `http://127.0.0.1:${args.port}`;
    const tokenFile = join(paths.dataDir, 'auth-token');
    try {
      const token = readFileSync(tokenFile, 'utf-8').trim();
      if (token) {
        url += `/?token=${token}`;
      }
    } catch {
      // token file not ready
    }
    authLine = 'Token cookie (valid 7 days)';
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log(`  ✅ Claw Insights v${process.env.npm_package_version ?? '0.1.0'}    ready in ${elapsed}s`);
  console.log('');
  console.log(`  ➜  Open:  ${url}`);
  console.log(`     Auth:  ${authLine}`);
  console.log('');
  console.log(`  PID ${child.pid} · ${mode} · Port ${args.port}`);
  console.log(`  Running in background — this terminal is free to use.`);
  console.log('');
  console.log('  claw-insights status | stop | logs');
  console.log('');

  // Auto-open browser if --open flag was passed
  if (args.open && !args.serverOnly) {
    const { openBrowser } = await import('./open-browser.js');
    openBrowser(url);
  }
}

export async function daemonStop(): Promise<void> {
  const paths = getDaemonPaths();
  const pidFile = new PidFile(paths.pidFile);
  const pid = pidFile.read();

  if (pid === null) {
    console.log('💡 Claw Insights is not running.');
    return;
  }

  if (!pidFile.isAlive()) {
    console.log('💡 Stale PID file found. Cleaning up.');
    pidFile.remove();
    return;
  }

  const spinner = createSpinner(`Stopping Claw Insights (PID ${pid})...`);

  // Send SIGTERM (may throw if process exited between isAlive check and kill)
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Process already gone — clean up and return
    pidFile.remove();
    cleanupAuthToken(paths.dataDir);
    spinner.stop('💡 Claw Insights stopped (process already exited).');
    return;
  }

  try {
    // Wait up to 5 seconds for graceful shutdown
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (!pidFile.isAlive()) {
        pidFile.remove();
        cleanupAuthToken(paths.dataDir);
        spinner.stop('💡 Claw Insights stopped.');
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    // Force kill
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already dead
    }
    pidFile.remove();
    cleanupAuthToken(paths.dataDir);
    spinner.stop('💡 Claw Insights force-killed.');
  } catch (err) {
    log.error({ err, pid }, 'daemon stop failed');
    spinner.stop(`❌ Stop failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

function cleanupAuthToken(dataDir: string): void {
  try {
    const tokenFile = join(dataDir, 'auth-token');
    if (existsSync(tokenFile)) {
      unlinkSync(tokenFile);
    }
  } catch {
    /* best effort */
  }
}

interface HealthResponse {
  status: string;
  [key: string]: unknown;
}

async function waitForHealth(port: number, timeoutMs: number, earlyExit?: () => boolean): Promise<boolean> {
  const spinner = createSpinner('Starting server...');
  const startTime = Date.now();
  const deadline = startTime + timeoutMs;
  try {
    // Phase 1: wait for HTTP to respond (server process up)
    while (Date.now() < deadline) {
      if (earlyExit?.()) {
        spinner.stop('❌ Server exited unexpectedly.');
        return false;
      }
      spinner.update(`Starting server... (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`);
        if (res.ok) {
          const body = (await res.json()) as HealthResponse;
          if (body.status === 'ok') {
            spinner.stop('✅ Server is ready.');
            return true;
          }
          // status === 'starting': server is up but still initializing
          break;
        }
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // Phase 2: server responded but still initializing (scanning transcripts)
    const initDeadline = Date.now() + 120_000; // generous 2 min for large transcript dirs
    while (Date.now() < initDeadline) {
      if (earlyExit?.()) {
        spinner.stop('❌ Server exited unexpectedly.');
        return false;
      }
      spinner.update(`Initializing... (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`);
        if (res.ok) {
          const body = (await res.json()) as HealthResponse;
          if (body.status === 'ok') {
            spinner.stop('✅ Server is ready.');
            return true;
          }
        }
      } catch {
        // transient failure
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    spinner.stop('⚠️  Server started but initialization timed out.');
    return false;
  } catch (err) {
    spinner.stop(`❌ Health check failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

export async function daemonStatus(): Promise<void> {
  const paths = getDaemonPaths();
  const pidFile = new PidFile(paths.pidFile);
  const pid = pidFile.read();

  if (pid === null || !pidFile.isAlive()) {
    console.log('💡 Claw Insights is not running.');
    if (pid !== null) {
      pidFile.cleanStale();
    }
    return;
  }

  // Try health check
  let config: Record<string, unknown> = {};
  if (existsSync(paths.daemonJson)) {
    try {
      config = JSON.parse(readFileSync(paths.daemonJson, 'utf-8'));
    } catch {
      /* ignore */
    }
  }

  const port = (config.port as number) ?? 41041;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const health = (await res.json()) as Record<string, unknown>;
    console.log(`💡 Claw Insights is running`);
    console.log(`   PID:     ${pid}`);
    console.log(`   Port:    ${port}`);
    console.log(`   Mode:    ${health.mode ?? 'unknown'}`);
    console.log(`   Uptime:  ${health.uptime ?? '?'}s`);
    console.log(`   Gateway: ${health.gateway ?? 'unknown'}`);
    console.log(`   DB:      ${health.db ?? 'unknown'}`);

    // Show access URL
    const noAuth = config.noAuth === true;
    if (noAuth) {
      console.log(`   URL:     http://127.0.0.1:${port}/`);
    } else {
      const tokenFile = join(paths.dataDir, 'auth-token');
      try {
        const token = readFileSync(tokenFile, 'utf-8').trim();
        if (token) {
          console.log(`   🔑 URL:  http://127.0.0.1:${port}/?token=${token}`);
        }
      } catch {
        console.log(`   URL:     http://127.0.0.1:${port}/ (token file missing — restart to regenerate)`);
      }
    }
  } catch {
    console.log(`💡 Claw Insights is running (PID ${pid}), but health check failed on :${port}`);
  }
}

export function readRecentLayeredErrorHints(logDir: string, lines: number): string[] {
  try {
    const segments = readdirSync(logDir)
      .map((name) => parseLayeredSegment(logDir, name))
      .filter((segment): segment is LayeredSegment => segment !== null)
      .filter((segment) => segment.stream === 'error')
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.seq - b.seq;
      });

    const latestError = segments[segments.length - 1];
    if (!latestError || !existsSync(latestError.path)) {
      return [];
    }

    const content = readFileSync(latestError.path, 'utf-8');
    return content.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

export function hasPortConflictHint(lines: string[]): boolean {
  return lines.some((line) => line.includes('EADDRINUSE') || line.includes('already in use'));
}

function tailLinesFromFile(filePath: string, lines: number): string {
  const content = readFileSync(filePath, 'utf-8');
  return content.split('\n').slice(-lines).join('\n');
}

function followFile(filePath: string): void {
  let lastSize = existsSync(filePath) ? statSync(filePath).size : 0;

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8', start: 0 }),
  });
  rl.on('line', (line) => {
    console.log(line);
  });
  rl.on('close', () => {
    lastSize = existsSync(filePath) ? statSync(filePath).size : lastSize;
  });

  const watcher = setInterval(() => {
    if (!existsSync(filePath)) {
      return;
    }
    const currentSize = statSync(filePath).size;
    if (currentSize > lastSize) {
      const stream = createReadStream(filePath, {
        encoding: 'utf-8',
        start: lastSize,
      });
      stream.on('data', (chunk) => {
        process.stdout.write(String(chunk));
      });
      lastSize = currentSize;
    }
  }, 500);

  process.on('SIGINT', () => {
    clearInterval(watcher);
    process.exit(0);
  });
}

export function daemonLogs(lines?: number): void {
  const paths = getDaemonPaths();
  const files = selectDefaultLayeredLogFiles(paths.logDir);

  if (files.length === 0) {
    console.log('No layered log files found.');
    console.log(`Checked: ${paths.logDir}`);
    console.log('Try: claw-insights status');
    console.log('Try: claw-insights start (or restart)');
    return;
  }

  if (lines) {
    for (const file of files) {
      const label = file.includes('/error.') ? 'error.log' : 'app.log';
      console.log(`\n=== ${label} (${file}) ===`);
      console.log(tailLinesFromFile(file, lines));
    }
    return;
  }

  // Default stream for follow mode: error lane first, then app lane snapshot.
  const errorFile = files.find((f) => f.includes('/error.'));
  const appFile = files.find((f) => f.includes('/app.'));

  if (appFile) {
    console.log(`\n=== app.log (${appFile}) [snapshot] ===`);
    console.log(tailLinesFromFile(appFile, 80));
  }

  if (errorFile) {
    console.log(`\n=== error.log (${errorFile}) [follow] ===`);
    followFile(errorFile);
  }
}

export async function daemonRestart(args: CliArgs, serverEntry: string): Promise<void> {
  const paths = getDaemonPaths();
  const pidFile = new PidFile(paths.pidFile);

  // Load saved args if restarting without explicit flags
  if (existsSync(paths.daemonJson)) {
    try {
      const saved = JSON.parse(readFileSync(paths.daemonJson, 'utf-8'));
      // Restore all saved config (restart = same config as last run)
      if (!args.portExplicit) {
        args.port = saved.port ?? args.port;
      }
      if (!args.webPortExplicit) {
        args.webPort = saved.webPort ?? args.webPort;
      }
      if (!args.serverOnly) {
        args.serverOnly = saved.serverOnly ?? false;
      }
      if (!args.noAuth) {
        args.noAuth = saved.noAuth ?? false;
      }
      if (!args.gateway) {
        args.gateway = saved.gateway;
      }
    } catch {
      /* ignore */
    }
  }

  // --open is only for initial start, not restart
  args.open = false;

  // Stop if running
  if (pidFile.isAlive()) {
    await daemonStop();
  }

  await daemonStart(args, serverEntry);
}
