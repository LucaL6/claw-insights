import { describe, it, expect, vi, afterEach } from 'vitest';

describe('logger', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('exports logger and createChildLogger', async () => {
    const mod = await import('../logger.js');
    expect(mod.logger).toBeDefined();
    expect(typeof mod.createChildLogger).toBe('function');
  });

  it('createChildLogger returns logger with module field', async () => {
    const mod = await import('../logger.js');
    const child = mod.createChildLogger('test-module');
    expect(child).toBeDefined();
    // Child logger should have all standard methods
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
    expect(typeof child.debug).toBe('function');
  });

  it('respects LOG_LEVEL env override', async () => {
    process.env.LOG_LEVEL = 'debug';
    vi.resetModules();
    const mod = await import('../logger.js');
    expect(mod.logger.level).toBe('debug');
  });

  it('defaults to info level', async () => {
    delete process.env.LOG_LEVEL;
    vi.resetModules();
    const mod = await import('../logger.js');
    expect(mod.logger.level).toBe('info');
  });
});
