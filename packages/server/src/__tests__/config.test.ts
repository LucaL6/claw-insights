import { describe, it, expect } from 'vitest';
import { config, CLI_ENV } from '../config.js';

describe('config', () => {
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

  it('should have claw-insights DB path by default', async () => {
    const { config } = await import('../config.js');
    expect(config.dbPath).toContain('.claw-insights');
    expect(config.dbPath).toContain('metrics.db');
  });

  it('should have retention defaults', async () => {
    const { config } = await import('../config.js');
    expect(config.rawRetentionDays).toBe(7);
    expect(config.hourlyRetention).toBe('permanent');
    expect(config.aggregateIntervalMs).toBe(6 * 60 * 60 * 1000);
  });

  it('should have CLAW_INSIGHTS env prefix with OPENCLAW fallback', async () => {
    const { config } = await import('../config.js');
    expect(config).toHaveProperty('rawRetentionDays');
    expect(config).toHaveProperty('hourlyRetention');
    expect(config).toHaveProperty('aggregateIntervalMs');
  });

  it('config has serverOnly field', async () => {
    const mod = await import('../config.js');
    expect(mod.config).toHaveProperty('serverOnly');
    expect(typeof mod.config.serverOnly).toBe('boolean');
  });

  it('CLI_ENV PATH includes npm-global', () => {
    expect(CLI_ENV.PATH).toContain('.npm-global/bin');
  });
});
