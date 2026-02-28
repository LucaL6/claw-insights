import { describe, expect, it } from 'vitest';

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
