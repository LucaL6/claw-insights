import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createChildLogger } from './logger.js';

const log = createChildLogger('config');

const HOME = process.env.HOME ?? '/tmp';

// --- Helpers (exported for testing) ---

export function safePort(env: string | undefined, fallback: number): number {
  if (!env) {
    return fallback;
  }
  const n = parseInt(env, 10);
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : fallback;
}

export function safeInt(env: string | undefined, fallback: number): number {
  if (!env) {
    return fallback;
  }
  const n = parseInt(env, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function envBool(val: string | undefined): boolean | undefined {
  if (val === undefined || val === '') {
    return undefined;
  }
  return val === 'true' || val === '1';
}

/** Prefer CLAW_INSIGHTS_*, fall back to OPENCLAW_* */
function env(key: string): string | undefined {
  return process.env[`CLAW_INSIGHTS_${key}`] ?? process.env[`OPENCLAW_${key}`];
}

// --- Token ---

const MIN_TOKEN_LENGTH = 32;

export function validateToken(token: string): void {
  if (token === '') {
    return;
  } // empty = will be auto-generated
  if (token.length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `API token too short (got ${token.length} chars, need ≥${MIN_TOKEN_LENGTH}). ` +
        `Use a strong token or remove it to auto-generate.`,
    );
  }
}

export function generateToken(): string {
  return randomBytes(16).toString('hex');
}

// --- NODE_ENV defaults ---

type Env = 'development' | 'test' | 'production';

interface EnvDefaults {
  serverPort: number;
  webPort: number;
  noAuth: boolean;
  dbSuffix: string;
  rawRetentionDays: number;
}

const ENV_DEFAULTS: Record<Env, EnvDefaults> = {
  development: {
    serverPort: 41041,
    webPort: 41042,
    noAuth: true,
    dbSuffix: 'metrics.db',
    rawRetentionDays: 7,
  },
  test: {
    serverPort: 4111,
    webPort: 3211,
    noAuth: true,
    dbSuffix: 'test-metrics.db',
    rawRetentionDays: 1,
  },
  production: {
    serverPort: 41041,
    webPort: 41042,
    noAuth: false,
    dbSuffix: 'metrics.db',
    rawRetentionDays: 7,
  },
};

// --- Config file ---

export function getDataDir(): string {
  return join(HOME, '.claw-insights');
}

export function loadConfigFile(): Record<string, unknown> {
  const configPath = join(getDataDir(), 'config.json');
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    // Warn if apiToken present and permissions too loose (Unix only)
    if (raw.apiToken && process.platform !== 'win32') {
      try {
        const mode = statSync(configPath).mode & 0o777;
        if (mode > 0o600) {
          log.warn(
            { path: configPath, mode: `0${mode.toString(8)}` },
            'config file contains apiToken but has loose permissions — run chmod 600',
          );
        }
      } catch {
        /* best effort */
      }
    }
    if (typeof raw !== 'object' || raw === null) {
      return {};
    }
    // Warn about unknown keys
    const knownKeys = new Set([
      'serverPort',
      'webPort',
      'apiToken',
      'noAuth',
      'dbPath',
      'logLevel',
      'rawRetentionDays',
      'serverOnly',
      'hourlyRetention',
      'transcriptsDir',
      'deviceJsonPath',
    ]);
    for (const key of Object.keys(raw)) {
      if (!knownKeys.has(key)) {
        log.warn({ key, path: configPath }, 'unknown config key, ignoring');
      }
    }
    return raw;
  } catch {
    log.warn({ path: configPath }, 'failed to parse config file, using defaults');
    return {};
  }
}

// --- Resolve ---

export interface AppConfig {
  cliPath: string;
  sessionsPath: string;
  logDir: string;
  cronPath: string;
  transcriptsDir: string;
  deviceJsonPath: string;
  openclawDir: string;
  dbPath: string;
  serverPort: number;
  webPort: number;
  apiToken: string;
  noAuth: boolean;
  isDev: boolean;
  serverOnly: boolean;
  rawRetentionDays: number;
  hourlyRetention: string;
  aggregateIntervalMs: number;
  scanTiered: boolean;
}

// --- CLI path detection (BUG-023) ---

import { execFileSync } from 'node:child_process';

export function detectCliPath(): string {
  // 1. Explicit env var
  const fromEnv = env('CLI');
  if (fromEnv) {
    return fromEnv;
  }

  // 2. `which openclaw` — resolves PATH on Unix-like systems
  try {
    const found = execFileSync('which', ['openclaw'], { encoding: 'utf-8', timeout: 3000 }).trim();
    if (found) {
      return found;
    }
  } catch {
    /* not in PATH */
  }

  // 3. Common install locations
  const candidates = [
    `${HOME}/.npm-global/bin/openclaw`,
    '/usr/local/bin/openclaw',
    '/opt/homebrew/bin/openclaw',
    `${HOME}/.bun/bin/openclaw`,
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return p;
    }
  }

  // 4. Bare name — let PATH resolve at runtime
  return 'openclaw';
}

export function resolveConfig(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as Env;
  const defaults = ENV_DEFAULTS[nodeEnv] ?? ENV_DEFAULTS.development;
  const file = loadConfigFile();
  const dataDir = getDataDir();

  const apiToken = env('API_TOKEN') ?? (typeof file.apiToken === 'string' ? file.apiToken : undefined) ?? '';
  validateToken(apiToken);

  return {
    cliPath: detectCliPath(),
    sessionsPath: env('SESSIONS_PATH') ?? `${HOME}/.openclaw/agents/main/sessions/sessions.json`,
    logDir: env('LOG_DIR') ?? '/tmp/openclaw/',
    cronPath: env('CRON_PATH') ?? `${HOME}/.openclaw/cron/jobs.json`,
    transcriptsDir: env('TRANSCRIPTS_DIR') ?? join(env('DIR') ?? `${HOME}/.openclaw`, 'agents/main/sessions'),
    deviceJsonPath: env('DEVICE_JSON') ?? join(env('DIR') ?? `${HOME}/.openclaw`, 'identity/device.json'),
    openclawDir: env('DIR') ?? `${HOME}/.openclaw`,
    dbPath:
      env('DB') ??
      env('DB_PATH') ??
      (typeof file.dbPath === 'string' ? file.dbPath : undefined) ??
      join(dataDir, defaults.dbSuffix),
    serverPort: safePort(
      env('SERVER_PORT'),
      typeof file.serverPort === 'number' ? file.serverPort : defaults.serverPort,
    ),
    webPort: safePort(env('WEB_PORT'), typeof file.webPort === 'number' ? file.webPort : defaults.webPort),
    apiToken,
    noAuth: envBool(env('NO_AUTH')) ?? (typeof file.noAuth === 'boolean' ? file.noAuth : undefined) ?? defaults.noAuth,
    isDev: nodeEnv !== 'production',
    serverOnly: env('SERVER_ONLY') === 'true',
    rawRetentionDays: safeInt(
      env('RAW_RETENTION_DAYS'),
      typeof file.rawRetentionDays === 'number' ? file.rawRetentionDays : defaults.rawRetentionDays,
    ),
    hourlyRetention: env('HOURLY_RETENTION') ?? 'permanent',
    aggregateIntervalMs: 6 * 60 * 60 * 1000,
    scanTiered: envBool(env('SCAN_TIERED')) ?? true,
  };
}

// --- Singleton (backward compat) ---
// Mutable: index.ts sets apiToken at startup when auto-generating

export const config: AppConfig = resolveConfig();
log.info({ dbPath: config.dbPath, serverPort: config.serverPort, isDev: config.isDev }, 'config loaded');

/** Set the runtime API token (used for auto-generation at startup). */
export function setApiToken(token: string): void {
  (config as { apiToken: string }).apiToken = token;
}

function buildCliPath(): string {
  const extraDirs = [`${HOME}/.npm-global/bin`, `${HOME}/.bun/bin`].filter((dir) => existsSync(dir));
  return [...extraDirs, process.env.PATH].filter(Boolean).join(':');
}

export const CLI_ENV = {
  ...process.env,
  PATH: buildCliPath(),
};
