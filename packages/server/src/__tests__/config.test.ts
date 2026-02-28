import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    ] as const;
    for (const k of keys) {
      expect(config).toHaveProperty(k);
    }
  });

  it('source contains no hardcoded ./', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync(new URL('../config.ts', import.meta.url), 'utf-8');
    expect(src).not.toContain('./');
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
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { loadConfigFile } = await import('../config.js');
    expect(loadConfigFile()).toEqual({});
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('warns on unknown config keys', async () => {
    writeFileSync(
      join(testDir, '.claw-insights', 'config.json'),
      JSON.stringify({ unknownFooBar: true, serverPort: 3000 }),
    );
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { loadConfigFile } = await import('../config.js');
    loadConfigFile();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown config key'));
    spy.mockRestore();
  });

  it('warns on loose permissions when apiToken present', async () => {
    const cfgPath = join(testDir, '.claw-insights', 'config.json');
    writeFileSync(cfgPath, JSON.stringify({ apiToken: 'a'.repeat(32) }));
    chmodSync(cfgPath, 0o644);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { loadConfigFile } = await import('../config.js');
    loadConfigFile();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('loose permissions'));
    spy.mockRestore();
  });
});
