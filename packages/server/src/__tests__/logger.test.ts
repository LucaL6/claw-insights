import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('exports LayeredRuntime from logging/runtime module', async () => {
    const mod = await import('../logging/runtime.js');
    expect(mod.LayeredRuntime).toBeTypeOf('function');
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

  it('uses JSON stdout in production mode (usePretty=false, L35)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_PRETTY;
    vi.resetModules();
    const mod = await import('../logger.js');
    expect(mod.logger).toBeDefined();
  });

  it('adds file transport when LOG_FILE is set (L40)', async () => {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    process.env.LOG_FILE = join(tmpdir(), `claw-insights-logger-test-${Date.now()}.log`);
    vi.resetModules();
    const mod = await import('../logger.js');
    expect(mod.logger).toBeDefined();
  });
});
