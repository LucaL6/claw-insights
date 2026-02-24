import { afterEach,describe, expect, it, vi } from 'vitest';

describe('token auto-generation', () => {
  afterEach(() => { vi.resetModules(); });

  it('generateToken returns 32-char hex string', async () => {
    const { generateToken } = await import('../config.js');
    const token = generateToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generateToken returns unique values', async () => {
    const { generateToken } = await import('../config.js');
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});
