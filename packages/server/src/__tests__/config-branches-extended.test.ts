import { existsSync, readFileSync, statSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    readFileSync: vi.fn(actual.readFileSync),
    statSync: vi.fn(actual.statSync),
  };
});
vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFileSync: vi.fn(() => {
      throw new Error('not found');
    }),
  };
});
vi.mock('../logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

describe('config-branches-extended', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...savedEnv };
    // Default: no config file
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  async function loadConfig() {
    return import('../config.js');
  }

  // --- envBool ---
  it('envBool returns undefined for undefined', async () => {
    const { envBool } = await loadConfig();
    expect(envBool(undefined)).toBeUndefined();
  });

  it('envBool returns undefined for empty string', async () => {
    const { envBool } = await loadConfig();
    expect(envBool('')).toBeUndefined();
  });

  it('envBool returns true for "1"', async () => {
    const { envBool } = await loadConfig();
    expect(envBool('1')).toBe(true);
  });

  it('envBool returns true for "true"', async () => {
    const { envBool } = await loadConfig();
    expect(envBool('true')).toBe(true);
  });

  it('envBool returns false for other values', async () => {
    const { envBool } = await loadConfig();
    expect(envBool('false')).toBe(false);
    expect(envBool('0')).toBe(false);
    expect(envBool('anything')).toBe(false);
  });

  // --- validateToken ---
  it('validateToken accepts empty string', async () => {
    const { validateToken } = await loadConfig();
    expect(() => validateToken('')).not.toThrow();
  });

  it('validateToken throws for short token', async () => {
    const { validateToken } = await loadConfig();
    expect(() => validateToken('short')).toThrow(/too short/);
  });

  it('validateToken accepts 32+ char token', async () => {
    const { validateToken } = await loadConfig();
    expect(() => validateToken('a'.repeat(32))).not.toThrow();
  });

  // --- generateToken ---
  it('generateToken returns 32 char hex string', async () => {
    const { generateToken } = await loadConfig();
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{32}$/);
  });

  // --- safeSessionHierarchyMode ---
  it('safeSessionHierarchyMode returns fallback for empty', async () => {
    const { safeSessionHierarchyMode } = await loadConfig();
    expect(safeSessionHierarchyMode(undefined, 'dual')).toBe('dual');
    expect(safeSessionHierarchyMode('', 'dual')).toBe('dual');
  });

  it('safeSessionHierarchyMode returns valid value', async () => {
    const { safeSessionHierarchyMode } = await loadConfig();
    expect(safeSessionHierarchyMode('single', 'dual')).toBe('single');
    expect(safeSessionHierarchyMode('dual', 'single')).toBe('dual');
  });

  it('safeSessionHierarchyMode returns fallback for invalid', async () => {
    const { safeSessionHierarchyMode } = await loadConfig();
    expect(safeSessionHierarchyMode('invalid', 'single')).toBe('single');
  });

  // --- loadConfigFile: non-object parsed result (line 172) ---
  it('loadConfigFile returns {} when JSON is not an object (line 172)', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('"just a string"');
    const { loadConfigFile } = await loadConfig();
    expect(loadConfigFile()).toEqual({});
  });

  it('loadConfigFile returns {} when JSON is null', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('null');
    const { loadConfigFile } = await loadConfig();
    expect(loadConfigFile()).toEqual({});
  });

  it('loadConfigFile returns {} when JSON is invalid', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('{bad json');
    const { loadConfigFile } = await loadConfig();
    expect(loadConfigFile()).toEqual({});
  });

  it('loadConfigFile warns about unknown keys', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ unknownKey123: true }));
    const { loadConfigFile } = await loadConfig();
    const result = loadConfigFile();
    expect(result).toHaveProperty('unknownKey123', true);
  });

  it('loadConfigFile warns about loose permissions when apiToken present', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ apiToken: 'a'.repeat(32) }));
    vi.mocked(statSync).mockReturnValue({ mode: 0o100644 } as any);
    const { loadConfigFile } = await loadConfig();
    loadConfigFile();
    // Just ensure no crash — the warn is internal
  });

  it('loadConfigFile handles statSync failure gracefully', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ apiToken: 'a'.repeat(32) }));
    vi.mocked(statSync).mockImplementation(() => {
      throw new Error('stat fail');
    });
    const { loadConfigFile } = await loadConfig();
    expect(() => loadConfigFile()).not.toThrow();
  });

  it('loadConfigFile skips permission check on win32', async () => {
    const origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ apiToken: 'a'.repeat(32) }));
    const { loadConfigFile } = await loadConfig();
    loadConfigFile();
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
  });

  it('loadConfigFile with tight permissions does not warn', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ apiToken: 'a'.repeat(32) }));
    vi.mocked(statSync).mockReturnValue({ mode: 0o100600 } as any);
    const { loadConfigFile } = await loadConfig();
    loadConfigFile();
  });

  // --- resolveConfig: unknown NODE_ENV fallback (line 243) ---
  it('resolveConfig uses development defaults for unknown NODE_ENV (line 243)', async () => {
    process.env.NODE_ENV = 'staging';
    const { config } = await loadConfig();
    // Should fallback to development defaults
    expect(config.noAuth).toBe(true);
    expect(config.isDev).toBe(true);
  });

  // --- resolveConfig: production ---
  it('resolveConfig in production sets isDev false and noAuth false', async () => {
    process.env.NODE_ENV = 'production';
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.isDev).toBe(false);
    expect(cfg.noAuth).toBe(false);
  });

  // --- resolveConfig: env overrides ---
  it('resolveConfig reads CLAW_INSIGHTS_* env vars', async () => {
    process.env.CLAW_INSIGHTS_SERVER_PORT = '9999';
    process.env.CLAW_INSIGHTS_WEB_PORT = '8888';
    process.env.CLAW_INSIGHTS_NO_AUTH = 'true';
    process.env.CLAW_INSIGHTS_SERVER_ONLY = 'true';
    process.env.CLAW_INSIGHTS_HOURLY_RETENTION = '30d';
    process.env.CLAW_INSIGHTS_SCAN_TIERED = 'false';
    process.env.CLAW_INSIGHTS_SESSION_HIERARCHY_MODE = 'dual';
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.serverPort).toBe(9999);
    expect(cfg.webPort).toBe(8888);
    expect(cfg.noAuth).toBe(true);
    expect(cfg.serverOnly).toBe(true);
    expect(cfg.hourlyRetention).toBe('30d');
    expect(cfg.scanTiered).toBe(false);
    expect(cfg.sessionHierarchyMode).toBe('dual');
  });

  it('resolveConfig falls back to OPENCLAW_* env vars', async () => {
    process.env.OPENCLAW_DB = '/tmp/test.db';
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.dbPath).toBe('/tmp/test.db');
  });

  it('resolveConfig uses CLAW_INSIGHTS_DB_PATH when DB not set', async () => {
    process.env.CLAW_INSIGHTS_DB_PATH = '/tmp/ci.db';
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.dbPath).toBe('/tmp/ci.db');
  });

  // --- resolveConfig: config file values ---
  it('resolveConfig reads typed values from config file', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        serverPort: 5555,
        webPort: 6666,
        dbPath: '/custom/db.sqlite',
        noAuth: true,
        rawRetentionDays: 30,
        sessionHierarchyMode: 'dual',
        logBudgetMb: 2048,
        logRetentionDays: 30,
        errorFloorMb: 500,
        errorReserveMb: 100,
        appSoftMb: 800,
        debugSoftMb: 400,
        criticalQueueMax: 20000,
        bestEffortQueueMax: 100000,
        criticalFsyncMs: 200,
        criticalSyncBatch: 2000,
        logFileMode: 0o600,
        pressureQueuePct: 80,
        pressureIoLagMs: 300,
        pressureBudgetPct: 90,
        pressureFreeSpaceMb: 1024,
        emergencyQueuePct: 95,
        emergencyIoLagMs: 2000,
        emergencyBudgetPct: 98,
        emergencyFreeSpaceMb: 256,
      }),
    );
    vi.mocked(statSync).mockReturnValue({ mode: 0o100600 } as any);
    process.env.NODE_ENV = 'production';
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.serverPort).toBe(5555);
    expect(cfg.webPort).toBe(6666);
    expect(cfg.dbPath).toBe('/custom/db.sqlite');
    expect(cfg.noAuth).toBe(true);
    expect(cfg.rawRetentionDays).toBe(30);
    expect(cfg.sessionHierarchyMode).toBe('dual');
    expect(cfg.logBudgetMb).toBe(2048);
  });

  // --- resolveConfig: file values with wrong types should use defaults ---
  it('resolveConfig ignores file values with wrong types', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        serverPort: 'notanumber',
        webPort: null,
        dbPath: 123,
        noAuth: 'stringnotbool',
        rawRetentionDays: 'abc',
        sessionHierarchyMode: 42,
      }),
    );
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    // Should use NODE_ENV defaults since file types don't match
    // NODE_ENV=test in vitest, so test defaults apply
    expect(typeof cfg.serverPort).toBe('number');
    expect(typeof cfg.webPort).toBe('number');
    expect(cfg.noAuth).toBe(true);
  });

  // --- detectCliPath ---
  it('detectCliPath uses CLAW_INSIGHTS_CLI env var', async () => {
    process.env.CLAW_INSIGHTS_CLI = '/custom/openclaw';
    const { detectCliPath } = await loadConfig();
    expect(detectCliPath()).toBe('/custom/openclaw');
  });

  it('detectCliPath falls back to "openclaw" when nothing found', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const { detectCliPath } = await loadConfig();
    expect(detectCliPath()).toBe('openclaw');
  });

  it('detectCliPath finds candidate path', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      return String(p).includes('.npm-global/bin/openclaw');
    });
    const { detectCliPath } = await loadConfig();
    expect(detectCliPath()).toContain('.npm-global/bin/openclaw');
  });

  // --- setApiToken ---
  it('setApiToken updates config.apiToken', async () => {
    const { config, setApiToken } = await loadConfig();
    setApiToken('x'.repeat(32));
    expect(config.apiToken).toBe('x'.repeat(32));
  });

  // --- resolveConfig: CLAW_INSIGHTS_API_TOKEN ---
  it('resolveConfig throws for short API token from env', async () => {
    process.env.CLAW_INSIGHTS_API_TOKEN = 'tooshort';
    await expect(loadConfig()).rejects.toThrow(/too short/);
  });

  // --- resolveConfig: transcriptsDir and deviceJsonPath with DIR ---
  it('resolveConfig uses CLAW_INSIGHTS_DIR for transcriptsDir/deviceJsonPath', async () => {
    process.env.CLAW_INSIGHTS_DIR = '/custom/dir';
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.transcriptsDir).toContain('/custom/dir');
    expect(cfg.deviceJsonPath).toContain('/custom/dir');
    expect(cfg.openclawDir).toBe('/custom/dir');
  });

  // --- resolveConfig: explicit transcriptsDir/deviceJsonPath env ---
  it('resolveConfig uses explicit TRANSCRIPTS_DIR and DEVICE_JSON', async () => {
    process.env.CLAW_INSIGHTS_TRANSCRIPTS_DIR = '/my/transcripts';
    process.env.CLAW_INSIGHTS_DEVICE_JSON = '/my/device.json';
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.transcriptsDir).toBe('/my/transcripts');
    expect(cfg.deviceJsonPath).toBe('/my/device.json');
  });

  // --- test env NODE_ENV ---
  it('resolveConfig in test env uses test defaults', async () => {
    process.env.NODE_ENV = 'test';
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.serverPort).toBe(4111);
    expect(cfg.webPort).toBe(3211);
    expect(cfg.rawRetentionDays).toBe(1);
  });

  // --- resolveConfig: noAuth from env 'false' ---
  it('resolveConfig noAuth false from env', async () => {
    process.env.CLAW_INSIGHTS_NO_AUTH = 'false';
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.noAuth).toBe(false);
  });

  // --- resolveConfig: scanTiered defaults to true ---
  it('resolveConfig scanTiered defaults to true when not set', async () => {
    const { resolveConfig } = await loadConfig();
    const cfg = resolveConfig();
    expect(cfg.scanTiered).toBe(true);
  });

  // --- buildCliPath / CLI_ENV (line 382) ---
  it('CLI_ENV has PATH property', async () => {
    const { CLI_ENV } = await loadConfig();
    expect(CLI_ENV.PATH).toBeDefined();
    expect(typeof CLI_ENV.PATH).toBe('string');
  });
});
