import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createChildLogger } from './logger.js';

export {
  getAuthSecretPath,
  migrateLegacyApiTokenToSecret,
  readAuthSecret,
  writeAuthSecret,
} from './auth/secret-store.js';

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

export function safePositiveInt(env: string | undefined, fallback: number): number {
  if (!env) {
    return fallback;
  }
  const n = parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
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

export type SessionHierarchyMode = 'dual' | 'single';

export function safeSessionHierarchyMode(
  envValue: string | undefined,
  fallback: SessionHierarchyMode,
): SessionHierarchyMode {
  if (!envValue) {
    return fallback;
  }
  return envValue === 'single' || envValue === 'dual' ? envValue : fallback;
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

export const knownKeys = new Set([
  'serverPort',
  'webPort',
  'apiToken',
  'apiTokenState',
  'tokenRotationEnabled',
  'tokenRotationIntervalMs',
  'tokenGraceMs',
  'tokenRotationCheckIntervalMs',
  'tokenMaxPrevious',
  'noAuth',
  'dbPath',
  'logLevel',
  'rawRetentionDays',
  'serverOnly',
  'hourlyRetention',
  'transcriptsDir',
  'deviceJsonPath',
  'sessionHierarchyMode',
  'logBudgetMb',
  'logRetentionDays',
  'errorFloorMb',
  'errorReserveMb',
  'appSoftMb',
  'debugSoftMb',
  'criticalQueueMax',
  'bestEffortQueueMax',
  'criticalFsyncMs',
  'criticalSyncBatch',
  'logFileMode',
  'pressureQueuePct',
  'pressureIoLagMs',
  'pressureBudgetPct',
  'pressureFreeSpaceMb',
  'emergencyQueuePct',
  'emergencyIoLagMs',
  'emergencyBudgetPct',
  'emergencyFreeSpaceMb',
]);

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
  tokenRotationEnabled: boolean;
  tokenRotationIntervalMs: number;
  tokenGraceMs: number;
  tokenRotationCheckIntervalMs: number;
  tokenMaxPrevious: number;
  isDev: boolean;
  serverOnly: boolean;
  rawRetentionDays: number;
  hourlyRetention: string;
  aggregateIntervalMs: number;
  scanTiered: boolean;
  sessionHierarchyMode: SessionHierarchyMode;
  logBudgetMb: number;
  logRetentionDays: number;
  errorFloorMb: number;
  errorReserveMb: number;
  appSoftMb: number;
  debugSoftMb: number;
  criticalQueueMax: number;
  bestEffortQueueMax: number;
  criticalFsyncMs: number;
  criticalSyncBatch: number;
  logFileMode: number;
  pressureQueuePct: number;
  pressureIoLagMs: number;
  pressureBudgetPct: number;
  pressureFreeSpaceMb: number;
  emergencyQueuePct: number;
  emergencyIoLagMs: number;
  emergencyBudgetPct: number;
  emergencyFreeSpaceMb: number;
}

// --- CLI path detection (BUG-023) ---

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

  const defaultTokenRotationIntervalMs = 24 * 60 * 60 * 1000;
  const defaultTokenGraceMs = 12 * 60 * 60 * 1000;
  const defaultTokenRotationCheckIntervalMs = 5 * 60 * 1000;
  const defaultTokenMaxPrevious = 2;

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
    tokenRotationEnabled:
      envBool(env('TOKEN_ROTATION_ENABLED')) ??
      (typeof file.tokenRotationEnabled === 'boolean' ? file.tokenRotationEnabled : true),
    tokenRotationIntervalMs: safePositiveInt(
      env('TOKEN_ROTATION_INTERVAL_MS'),
      typeof file.tokenRotationIntervalMs === 'number' ? file.tokenRotationIntervalMs : defaultTokenRotationIntervalMs,
    ),
    tokenGraceMs: safePositiveInt(
      env('TOKEN_GRACE_MS'),
      typeof file.tokenGraceMs === 'number' ? file.tokenGraceMs : defaultTokenGraceMs,
    ),
    tokenRotationCheckIntervalMs: safePositiveInt(
      env('TOKEN_ROTATION_CHECK_INTERVAL_MS'),
      typeof file.tokenRotationCheckIntervalMs === 'number'
        ? file.tokenRotationCheckIntervalMs
        : defaultTokenRotationCheckIntervalMs,
    ),
    tokenMaxPrevious: safePositiveInt(
      env('TOKEN_MAX_PREVIOUS'),
      typeof file.tokenMaxPrevious === 'number' ? file.tokenMaxPrevious : defaultTokenMaxPrevious,
    ),
    isDev: nodeEnv !== 'production',
    serverOnly: env('SERVER_ONLY') === 'true',
    rawRetentionDays: safeInt(
      env('RAW_RETENTION_DAYS'),
      typeof file.rawRetentionDays === 'number' ? file.rawRetentionDays : defaults.rawRetentionDays,
    ),
    hourlyRetention: env('HOURLY_RETENTION') ?? 'permanent',
    aggregateIntervalMs: 6 * 60 * 60 * 1000,
    scanTiered: envBool(env('SCAN_TIERED')) ?? true,
    sessionHierarchyMode: safeSessionHierarchyMode(
      env('SESSION_HIERARCHY_MODE'),
      typeof file.sessionHierarchyMode === 'string'
        ? safeSessionHierarchyMode(file.sessionHierarchyMode, 'single')
        : 'single',
    ),
    logBudgetMb: safeInt(env('LOG_BUDGET_MB'), typeof file.logBudgetMb === 'number' ? file.logBudgetMb : 1024),
    logRetentionDays: safeInt(
      env('LOG_RETENTION_DAYS'),
      typeof file.logRetentionDays === 'number' ? file.logRetentionDays : 14,
    ),
    errorFloorMb: safeInt(env('ERROR_FLOOR_MB'), typeof file.errorFloorMb === 'number' ? file.errorFloorMb : 300),
    errorReserveMb: safeInt(
      env('ERROR_RESERVE_MB'),
      typeof file.errorReserveMb === 'number' ? file.errorReserveMb : 50,
    ),
    appSoftMb: safeInt(env('APP_SOFT_MB'), typeof file.appSoftMb === 'number' ? file.appSoftMb : 500),
    debugSoftMb: safeInt(env('DEBUG_SOFT_MB'), typeof file.debugSoftMb === 'number' ? file.debugSoftMb : 200),
    criticalQueueMax: safeInt(
      env('CRITICAL_QUEUE_MAX'),
      typeof file.criticalQueueMax === 'number' ? file.criticalQueueMax : 10_000,
    ),
    bestEffortQueueMax: safeInt(
      env('BEST_EFFORT_QUEUE_MAX'),
      typeof file.bestEffortQueueMax === 'number' ? file.bestEffortQueueMax : 50_000,
    ),
    criticalFsyncMs: safeInt(
      env('CRITICAL_FSYNC_MS'),
      typeof file.criticalFsyncMs === 'number' ? file.criticalFsyncMs : 100,
    ),
    criticalSyncBatch: safeInt(
      env('CRITICAL_SYNC_BATCH'),
      typeof file.criticalSyncBatch === 'number' ? file.criticalSyncBatch : 1000,
    ),
    logFileMode: safeInt(env('LOG_FILE_MODE'), typeof file.logFileMode === 'number' ? file.logFileMode : 0o644),
    pressureQueuePct: safeInt(
      env('PRESSURE_QUEUE_PCT'),
      typeof file.pressureQueuePct === 'number' ? file.pressureQueuePct : 70,
    ),
    pressureIoLagMs: safeInt(
      env('PRESSURE_IO_LAG_MS'),
      typeof file.pressureIoLagMs === 'number' ? file.pressureIoLagMs : 200,
    ),
    pressureBudgetPct: safeInt(
      env('PRESSURE_BUDGET_PCT'),
      typeof file.pressureBudgetPct === 'number' ? file.pressureBudgetPct : 85,
    ),
    pressureFreeSpaceMb: safeInt(
      env('PRESSURE_FREE_SPACE_MB'),
      typeof file.pressureFreeSpaceMb === 'number' ? file.pressureFreeSpaceMb : 512,
    ),
    emergencyQueuePct: safeInt(
      env('EMERGENCY_QUEUE_PCT'),
      typeof file.emergencyQueuePct === 'number' ? file.emergencyQueuePct : 90,
    ),
    emergencyIoLagMs: safeInt(
      env('EMERGENCY_IO_LAG_MS'),
      typeof file.emergencyIoLagMs === 'number' ? file.emergencyIoLagMs : 1000,
    ),
    emergencyBudgetPct: safeInt(
      env('EMERGENCY_BUDGET_PCT'),
      typeof file.emergencyBudgetPct === 'number' ? file.emergencyBudgetPct : 95,
    ),
    emergencyFreeSpaceMb: safeInt(
      env('EMERGENCY_FREE_SPACE_MB'),
      typeof file.emergencyFreeSpaceMb === 'number' ? file.emergencyFreeSpaceMb : 128,
    ),
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
