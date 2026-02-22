const HOME = process.env.HOME ?? '/tmp';

export function safePort(env: string | undefined, fallback: number): number {
  if (!env) return fallback;
  const n = parseInt(env, 10);
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : fallback;
}

export function safeInt(env: string | undefined, fallback: number): number {
  if (!env) return fallback;
  const n = parseInt(env, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Prefer CLAW_INSIGHTS_*, fall back to OPENCLAW_* */
function env(key: string): string | undefined {
  return process.env[`CLAW_INSIGHTS_${key}`] ?? process.env[`OPENCLAW_${key}`];
}

export const config = {
  // OpenClaw data sources (read-only, still use OPENCLAW prefix)
  cliPath: env('CLI') ?? `${HOME}/.npm-global/bin/openclaw`,
  sessionsPath: env('SESSIONS_PATH') ?? `${HOME}/.openclaw/agents/main/sessions/sessions.json`,
  logDir: env('LOG_DIR') ?? '/tmp/openclaw/',
  cronPath: env('CRON_PATH') ?? `${HOME}/.openclaw/cron/jobs.json`,
  openclawDir: env('DIR') ?? `${HOME}/.openclaw`,

  // Claw Insights own storage
  dbPath: env('DB') ?? env('DB_PATH') ?? `${HOME}/.claw-insights/metrics.db`,

  // Server
  serverPort: safePort(env('SERVER_PORT'), 4000),
  webPort: safePort(env('WEB_PORT'), 3200),
  apiToken: env('API_TOKEN') ?? '',
  isDev: process.env.NODE_ENV !== 'production',

  // Mode
  serverOnly: env('SERVER_ONLY') === 'true',

  // Data retention
  rawRetentionDays: safeInt(env('RAW_RETENTION_DAYS'), 7),
  hourlyRetention: env('HOURLY_RETENTION') ?? 'permanent',
  aggregateIntervalMs: 6 * 60 * 60 * 1000,
} as const;

export const CLI_ENV = {
  ...process.env,
  PATH: `${HOME}/.npm-global/bin:${HOME}/.bun/bin:${process.env.PATH}`,
};
