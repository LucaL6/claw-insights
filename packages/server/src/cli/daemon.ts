import { spawn } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { DEFAULT_ROTATE_OPTIONS, rotateIfNeeded } from './log-rotate.js';
import type { CliArgs } from './parse-args.js';
import { PidFile } from './pid.js';

const HOME = process.env.HOME ?? '/tmp';

export function getDataDir(): string {
  return join(HOME, '.claw-insights');
}

export function getDaemonPaths() {
  const dataDir = getDataDir();
  return {
    dataDir,
    pidFile: join(dataDir, 'claw-insights.pid'),
    logFile: join(dataDir, 'logs', 'server.log'),
    logDir: join(dataDir, 'logs'),
    daemonJson: join(dataDir, 'daemon.json'),
  };
}

export async function daemonStart(args: CliArgs, serverEntry: string): Promise<void> {
  const paths = getDaemonPaths();
  const pidFile = new PidFile(paths.pidFile);

  // Check for existing running instance
  if (pidFile.isAlive()) {
    const pid = pidFile.read();
    // Read saved config for actual port
    let savedPort = args.port;
    if (existsSync(paths.daemonJson)) {
      try {
        const saved = JSON.parse(readFileSync(paths.daemonJson, 'utf-8'));
        if (saved.port) savedPort = saved.port;
      } catch {
        /* ignore */
      }
    }
    console.log('');
    console.log('  ⚠️  Claw Insights is already running.');
    console.log('');
    console.log(`  PID:  ${pid}`);
    console.log(`  Port: ${savedPort}`);
    console.log('');
    console.log('  claw-insights status    Check health & access URL');
    console.log('  claw-insights restart   Restart the server');
    console.log('  claw-insights stop      Stop the server');
    console.log('');
    process.exit(1);
  }

  // Clean stale PID
  pidFile.cleanStale();

  const startTime = Date.now();

  // Ensure directories
  mkdirSync(paths.logDir, { recursive: true });

  // Rotate logs before starting
  rotateIfNeeded(paths.logFile, DEFAULT_ROTATE_OPTIONS);

  // Save daemon config for restart (full snapshot + explicit tracking)
  const explicitKeys: string[] = [];
  if (args.portExplicit) explicitKeys.push('port');
  if (args.webPortExplicit) explicitKeys.push('webPort');
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

  // Open log file for output
  const logFd = openSync(paths.logFile, 'a');

  // Spawn detached child
  const child = spawn(process.execPath, [serverEntry], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: childEnv,
  });

  // Keep ref during startup to detect early crashes, unref after health check
  if (!child.pid) {
    console.error('❌ Failed to start daemon.');
    process.exit(1);
  }

  // Write PID file
  try {
    pidFile.write(child.pid);
  } catch (err) {
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
    try {
      const logContent = readFileSync(paths.logFile, 'utf-8');
      const lines = logContent.split('\n').filter(Boolean).slice(-8);
      const portConflict = lines.find((l) => l.includes('EADDRINUSE') || l.includes('already in use'));
      if (portConflict) {
        console.log(`  Reason: Port ${args.port} is already in use.`);
        console.log('');
        console.log('  Try:');
        console.log(`    claw-insights start --port ${args.port + 1}    # Use a different port`);
        console.log(`    claw-insights stop                       # Stop existing instance first`);
      } else {
        const meaningful = lines.filter((l) => !l.startsWith('{'));
        if (meaningful.length) {
          console.log('  Last output:');
          meaningful.slice(-3).forEach((l) => {
            console.log(`    ${l}`);
          });
        }
      }
    } catch {
      // can't read logs
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
}

export function daemonStop(): void {
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

  // Send SIGTERM
  process.kill(pid, 'SIGTERM');
  console.log(`💡 Stopping Claw Insights (PID ${pid})...`);

  // Wait up to 5 seconds for graceful shutdown
  const deadline = Date.now() + 5000;
  const poll = setInterval(() => {
    if (!pidFile.isAlive()) {
      clearInterval(poll);
      pidFile.remove();
      cleanupAuthToken(paths.dataDir);
      console.log('💡 Claw Insights stopped.');
      return;
    }
    if (Date.now() > deadline) {
      clearInterval(poll);
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // already dead
      }
      pidFile.remove();
      cleanupAuthToken(paths.dataDir);
      console.log('💡 Claw Insights force-killed.');
    }
  }, 200);
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

async function waitForHealth(port: number, timeoutMs: number, earlyExit?: () => boolean): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (earlyExit?.()) {
      return false;
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) {
        return true;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
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

export function daemonLogs(lines?: number): void {
  const paths = getDaemonPaths();

  if (!existsSync(paths.logFile)) {
    console.log('No log file found.');
    return;
  }

  if (lines) {
    // Read last N lines
    const content = readFileSync(paths.logFile, 'utf-8');
    const allLines = content.split('\n');
    const tail = allLines.slice(-lines).join('\n');
    console.log(tail);
  } else {
    // tail -f mode using setInterval + statSync poll
    let lastSize = existsSync(paths.logFile) ? statSync(paths.logFile).size : 0;

    // First, stream existing content
    const rl = createInterface({
      input: createReadStream(paths.logFile, { encoding: 'utf-8', start: 0 }),
    });
    rl.on('line', (line) => {
      console.log(line);
    });
    rl.on('close', () => {
      lastSize = existsSync(paths.logFile) ? statSync(paths.logFile).size : lastSize;
    });

    // Poll for new content
    const watcher = setInterval(() => {
      if (!existsSync(paths.logFile)) {
        return;
      }
      const currentSize = statSync(paths.logFile).size;
      if (currentSize > lastSize) {
        const stream = createReadStream(paths.logFile, {
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

  // Stop if running
  if (pidFile.isAlive()) {
    daemonStop();
    // Wait for process to fully exit
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await daemonStart(args, serverEntry);
}
