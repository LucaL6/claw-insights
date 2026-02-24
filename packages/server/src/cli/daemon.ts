import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, openSync, statSync, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { PidFile } from './pid.js';
import { rotateIfNeeded, DEFAULT_ROTATE_OPTIONS } from './log-rotate.js';
import type { CliArgs } from './parse-args.js';

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
    console.error(`💡 Claw Insights is already running (PID ${pid}). Use 'claw-insights restart' to restart.`);
    process.exit(1);
  }

  // Clean stale PID
  pidFile.cleanStale();

  // Ensure directories
  mkdirSync(paths.logDir, { recursive: true });

  // Rotate logs before starting
  rotateIfNeeded(paths.logFile, DEFAULT_ROTATE_OPTIONS);

  // Save daemon config for restart
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

  child.unref();

  if (!child.pid) {
    console.error('❌ Failed to start daemon.');
    process.exit(1);
  }

  // Write PID file
  pidFile.write(child.pid);

  const mode = args.serverOnly ? 'server-only' : 'full';
  console.log(`💡 Claw Insights started (PID ${child.pid}, mode: ${mode}, port: ${args.port})`);

  // Wait for server to be ready, then print access URL
  const ready = await waitForHealth(args.port, 5000);
  if (ready) {
    if (args.noAuth) {
      console.log(`🌐 http://127.0.0.1:${args.port}`);
    } else {
      // Read token from file written by server
      const tokenFile = join(paths.dataDir, 'auth-token');
      try {
        const token = readFileSync(tokenFile, 'utf-8').trim();
        if (token) {
          console.log(`🔑 http://127.0.0.1:${args.port}/?token=${token}`);
        } else {
          console.log(`🌐 http://127.0.0.1:${args.port} (run 'claw-insights status' for auth URL)`);
        }
      } catch {
        console.log(`🌐 http://127.0.0.1:${args.port} (run 'claw-insights status' for auth URL)`);
      }
    }
  } else {
    console.log(`🌐 http://127.0.0.1:${args.port} (server still starting...)`);
  }
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
      console.log('💡 Claw Insights force-killed.');
    }
  }, 200);
}

async function waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return true;
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
    if (pid !== null) pidFile.cleanStale();
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

  const port = (config.port as number) ?? 4000;

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
        console.log(`   URL:     http://127.0.0.1:${port}/ (run with --no-auth or check logs for token)`);
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
    rl.on('line', (line) => console.log(line));
    rl.on('close', () => {
      lastSize = existsSync(paths.logFile) ? statSync(paths.logFile).size : lastSize;
    });

    // Poll for new content
    const watcher = setInterval(() => {
      if (!existsSync(paths.logFile)) return;
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
      if (!args.port || args.port === 4000) args.port = saved.port ?? 4000;
      if (!args.serverOnly) args.serverOnly = saved.serverOnly ?? false;
      if (!args.noAuth) args.noAuth = saved.noAuth ?? false;
      if (!args.gateway) args.gateway = saved.gateway;
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
