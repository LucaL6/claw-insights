import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger so config.ts log.warn calls are captured
const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock('../logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: mockWarn, error: vi.fn(), debug: vi.fn() }),
}));

// Non-dynamic tests for existing exports
import { CLI_ENV, config } from '../config.js';

describe('config singleton', () => {
  it('has all required fields', () => {
    const keys = [
      'cliPath',
      'sessionsPath',
      'logDir',
      'cronPath',
      'dbPath',
      'openclawDir',
      'serverPort',
      'webPort',
      'apiToken',
      'isDev',
      'serverOnly',
      'rawRetentionDays',
      'hourlyRetention',
      'aggregateIntervalMs',
      'noAuth',
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
    ] as const;
    for (const k of keys) {
      expect(config).toHaveProperty(k);
    }
  });

  it('source contains no hardcoded ./ paths (except allowed logger import)', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync(new URL('../config.ts', import.meta.url), 'utf-8');
    // Filter out allowed ./ imports (logger is a sibling module)
    const filtered = src.replace(/from\s+'\.\/logger\.js'/g, '');
    expect(filtered).not.toContain('./');
  });

  it('should have claw-insights DB path by default', () => {
    expect(config.dbPath).toContain('.claw-insights');
    expect(config.dbPath).toContain('metrics.db');
  });

  it('should have retention defaults', () => {
    // In test env, rawRetentionDays defaults to 1
    expect([1, 7]).toContain(config.rawRetentionDays);
    expect(config.hourlyRetention).toBe('permanent');
    expect(config.aggregateIntervalMs).toBe(6 * 60 * 60 * 1000);
  });

  it('config has serverOnly field', () => {
    expect(typeof config.serverOnly).toBe('boolean');
  });

  // Environment-specific: only valid on dev machines with npm-global installed
  it.skipIf(process.env.CI)('CLI_ENV PATH includes npm-global', () => {
    expect(CLI_ENV.PATH).toContain('.npm-global/bin');
  });
});

describe('envBool', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns true for "true"', async () => {
    const { envBool } = await import('../config.js');
    expect(envBool('true')).toBe(true);
  });

  it('returns true for "1"', async () => {
    const { envBool } = await import('../config.js');
    expect(envBool('1')).toBe(true);
  });

  it('returns false for "false"', async () => {
    const { envBool } = await import('../config.js');
    expect(envBool('false')).toBe(false);
  });

  it('returns undefined for undefined', async () => {
    const { envBool } = await import('../config.js');
    expect(envBool(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', async () => {
    const { envBool } = await import('../config.js');
    expect(envBool('')).toBeUndefined();
  });
});

describe('NODE_ENV defaults', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('development defaults: noAuth true, port 41041', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CLAW_INSIGHTS_NO_AUTH;
    delete process.env.CLAW_INSIGHTS_SERVER_PORT;
    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();
    expect(cfg.noAuth).toBe(true);
    expect(cfg.serverPort).toBe(41041);
  });

  it('test defaults: noAuth true, port 4111/3211', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CLAW_INSIGHTS_SERVER_PORT;
    delete process.env.CLAW_INSIGHTS_WEB_PORT;
    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();
    expect(cfg.noAuth).toBe(true);
    expect(cfg.serverPort).toBe(4111);
    expect(cfg.webPort).toBe(3211);
  });

  it('production defaults: noAuth false, port 41041', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CLAW_INSIGHTS_NO_AUTH;
    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();
    expect(cfg.noAuth).toBe(false);
    expect(cfg.serverPort).toBe(41041);
  });

  it('env var overrides NODE_ENV default', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CLAW_INSIGHTS_NO_AUTH = 'true';
    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();
    expect(cfg.noAuth).toBe(true);
  });

  it('includes logging defaults', async () => {
    delete process.env.CLAW_INSIGHTS_LOG_BUDGET_MB;
    delete process.env.CLAW_INSIGHTS_PRESSURE_QUEUE_PCT;
    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();

    expect(cfg.logBudgetMb).toBe(1024);
    expect(cfg.logRetentionDays).toBe(14);
    expect(cfg.errorFloorMb).toBe(300);
    expect(cfg.errorReserveMb).toBe(50);
    expect(cfg.appSoftMb).toBe(500);
    expect(cfg.debugSoftMb).toBe(200);
    expect(cfg.criticalQueueMax).toBe(10_000);
    expect(cfg.bestEffortQueueMax).toBe(50_000);
    expect(cfg.criticalFsyncMs).toBe(100);
    expect(cfg.criticalSyncBatch).toBe(1000);
    expect(cfg.logFileMode).toBe(0o644);
    expect(cfg.pressureQueuePct).toBe(70);
    expect(cfg.pressureIoLagMs).toBe(200);
    expect(cfg.pressureBudgetPct).toBe(85);
    expect(cfg.pressureFreeSpaceMb).toBe(512);
    expect(cfg.emergencyQueuePct).toBe(90);
    expect(cfg.emergencyIoLagMs).toBe(1000);
    expect(cfg.emergencyBudgetPct).toBe(95);
    expect(cfg.emergencyFreeSpaceMb).toBe(128);
  });
});

describe('sessionHierarchyMode', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('defaults to single', async () => {
    delete process.env.CLAW_INSIGHTS_SESSION_HIERARCHY_MODE;
    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();
    expect(cfg.sessionHierarchyMode).toBe('single');
  });

  it('accepts env override dual | single', async () => {
    process.env.CLAW_INSIGHTS_SESSION_HIERARCHY_MODE = 'single';
    let { resolveConfig } = await import('../config.js');
    let cfg = resolveConfig();
    expect(cfg.sessionHierarchyMode).toBe('single');

    process.env.CLAW_INSIGHTS_SESSION_HIERARCHY_MODE = 'dual';
    ({ resolveConfig } = await import('../config.js'));
    cfg = resolveConfig();
    expect(cfg.sessionHierarchyMode).toBe('dual');
  });

  it('falls back to single for invalid env value', async () => {
    process.env.CLAW_INSIGHTS_SESSION_HIERARCHY_MODE = 'invalid-mode';
    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();
    expect(cfg.sessionHierarchyMode).toBe('single');
  });
});

describe('loadConfigFile', () => {
  const testDir = join(tmpdir(), 'claw-insights-config-test-' + Date.now());
  const originalHome = process.env.HOME;

  beforeEach(() => {
    mkdirSync(join(testDir, '.claw-insights'), { recursive: true });
    process.env.HOME = testDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(testDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('returns empty object when no config file', async () => {
    process.env.HOME = join(tmpdir(), 'nonexistent-' + Date.now());
    const { loadConfigFile } = await import('../config.js');
    expect(loadConfigFile()).toEqual({});
  });

  it('loads valid config file', async () => {
    writeFileSync(
      join(testDir, '.claw-insights', 'config.json'),
      JSON.stringify({ serverPort: 5000, apiToken: 'test-token-32chars-long-enough!!' }),
    );
    const { loadConfigFile } = await import('../config.js');
    const cfg = loadConfigFile();
    expect(cfg.serverPort).toBe(5000);
    expect(cfg.apiToken).toBe('test-token-32chars-long-enough!!');
  });

  it('returns empty object for invalid JSON', async () => {
    writeFileSync(join(testDir, '.claw-insights', 'config.json'), 'not json{{{');
    mockWarn.mockClear();
    const { loadConfigFile } = await import('../config.js');
    expect(loadConfigFile()).toEqual({});
    expect(mockWarn).toHaveBeenCalled();
  });

  it('warns on unknown config keys', async () => {
    writeFileSync(
      join(testDir, '.claw-insights', 'config.json'),
      JSON.stringify({ unknownFooBar: true, serverPort: 3000 }),
    );
    mockWarn.mockClear();
    const { loadConfigFile } = await import('../config.js');
    loadConfigFile();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'unknownFooBar' }),
      expect.stringContaining('unknown config key'),
    );
  });

  it('warns on loose permissions when apiToken present', async () => {
    const cfgPath = join(testDir, '.claw-insights', 'config.json');
    writeFileSync(cfgPath, JSON.stringify({ apiToken: 'a'.repeat(32) }));
    chmodSync(cfgPath, 0o644);
    mockWarn.mockClear();
    const { loadConfigFile } = await import('../config.js');
    loadConfigFile();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('config.json') }),
      expect.stringContaining('loose permissions'),
    );
  });
});
