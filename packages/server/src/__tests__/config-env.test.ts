import { afterEach, describe, expect, it, vi } from 'vitest';

import { envBool, generateToken, getDataDir, validateToken } from '../config.js';

describe('config utility branches', () => {
  it('envBool returns undefined for undefined', () => {
    expect(envBool(undefined)).toBeUndefined();
  });

  it('envBool returns undefined for empty string', () => {
    expect(envBool('')).toBeUndefined();
  });

  it('envBool returns true for "true"', () => {
    expect(envBool('true')).toBe(true);
  });

  it('envBool returns true for "1"', () => {
    expect(envBool('1')).toBe(true);
  });

  it('envBool returns false for other values', () => {
    expect(envBool('false')).toBe(false);
    expect(envBool('0')).toBe(false);
  });

  it('generateToken returns 32-char hex string', () => {
    const token = generateToken();
    expect(token.length).toBe(32);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('validateToken accepts empty string', () => {
    expect(() => validateToken('')).not.toThrow();
  });

  it('validateToken accepts long token', () => {
    expect(() => validateToken('a'.repeat(32))).not.toThrow();
  });

  it('validateToken rejects short token', () => {
    expect(() => validateToken('short')).toThrow(/too short/);
  });

  it('getDataDir returns path under HOME', () => {
    const dir = getDataDir();
    expect(dir).toContain('.claw-insights');
  });
});

describe('token rotation config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('defaults: enabled + 24h/12h/5min/2', async () => {
    delete process.env.CLAW_INSIGHTS_TOKEN_ROTATION_ENABLED;
    delete process.env.CLAW_INSIGHTS_TOKEN_ROTATION_INTERVAL_MS;
    delete process.env.CLAW_INSIGHTS_TOKEN_GRACE_MS;
    delete process.env.CLAW_INSIGHTS_TOKEN_ROTATION_CHECK_INTERVAL_MS;
    delete process.env.CLAW_INSIGHTS_TOKEN_MAX_PREVIOUS;

    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();

    expect(cfg.tokenRotationEnabled).toBe(true);
    expect(cfg.tokenRotationIntervalMs).toBe(24 * 60 * 60 * 1000);
    expect(cfg.tokenGraceMs).toBe(12 * 60 * 60 * 1000);
    expect(cfg.tokenRotationCheckIntervalMs).toBe(5 * 60 * 1000);
    expect(cfg.tokenMaxPrevious).toBe(2);
  });

  it('env override: each rotation var can override', async () => {
    process.env.CLAW_INSIGHTS_TOKEN_ROTATION_ENABLED = 'false';
    process.env.CLAW_INSIGHTS_TOKEN_ROTATION_INTERVAL_MS = '3600000';
    process.env.CLAW_INSIGHTS_TOKEN_GRACE_MS = '1800000';
    process.env.CLAW_INSIGHTS_TOKEN_ROTATION_CHECK_INTERVAL_MS = '60000';
    process.env.CLAW_INSIGHTS_TOKEN_MAX_PREVIOUS = '5';

    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();

    expect(cfg.tokenRotationEnabled).toBe(false);
    expect(cfg.tokenRotationIntervalMs).toBe(3600000);
    expect(cfg.tokenGraceMs).toBe(1800000);
    expect(cfg.tokenRotationCheckIntervalMs).toBe(60000);
    expect(cfg.tokenMaxPrevious).toBe(5);
  });

  it('invalid values: fallback to defaults', async () => {
    process.env.CLAW_INSIGHTS_TOKEN_ROTATION_INTERVAL_MS = 'not-a-number';
    process.env.CLAW_INSIGHTS_TOKEN_GRACE_MS = '-1000';
    process.env.CLAW_INSIGHTS_TOKEN_ROTATION_CHECK_INTERVAL_MS = '0';
    process.env.CLAW_INSIGHTS_TOKEN_MAX_PREVIOUS = 'NaN';

    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();

    expect(cfg.tokenRotationIntervalMs).toBe(24 * 60 * 60 * 1000);
    expect(cfg.tokenGraceMs).toBe(12 * 60 * 60 * 1000);
    expect(cfg.tokenRotationCheckIntervalMs).toBe(5 * 60 * 1000);
    expect(cfg.tokenMaxPrevious).toBe(2);
  });

  it('TOKEN_ROTATION_ENABLED=false disables rotation', async () => {
    process.env.CLAW_INSIGHTS_TOKEN_ROTATION_ENABLED = 'false';

    const { resolveConfig } = await import('../config.js');
    const cfg = resolveConfig();

    expect(cfg.tokenRotationEnabled).toBe(false);
  });
});
