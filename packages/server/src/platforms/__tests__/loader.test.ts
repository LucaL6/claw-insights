// src/platforms/__tests__/loader.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, platform: vi.fn() };
});
vi.mock('../../config.js', () => ({ config: { cliPath: 'openclaw' }, CLI_ENV: {} }));

import { platform as osPlatform } from 'node:os';

describe('loadPlatform', () => {
  it('loads darwin platform on macOS', async () => {
    vi.resetModules();
    (osPlatform as unknown as ReturnType<typeof vi.fn>).mockReturnValue('darwin');
    const { loadPlatform } = await import('../index.js');
    const p = await loadPlatform();
    expect(p.process).toBeDefined();
    expect(p.cli).toBeDefined();
  });

  it('loads linux platform on Linux', async () => {
    vi.resetModules();
    (osPlatform as unknown as ReturnType<typeof vi.fn>).mockReturnValue('linux');
    const { loadPlatform } = await import('../index.js');
    const p = await loadPlatform();
    expect(p.process).toBeDefined();
    expect(p.cli).toBeDefined();
  });

  it('throws on unsupported platform', async () => {
    vi.resetModules();
    (osPlatform as unknown as ReturnType<typeof vi.fn>).mockReturnValue('win32');
    const { loadPlatform } = await import('../index.js');
    await expect(loadPlatform()).rejects.toThrow('Unsupported platform: win32');
  });
});
