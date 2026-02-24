import { beforeEach,describe, expect, it, vi } from 'vitest';

// Mock child_process.execFile with promisify-compatible signature
vi.mock('node:child_process', () => {
  const mockFn = vi.fn((_cmd: string, _args: string[], _opts: Record<string, unknown>, cb: (...args: unknown[]) => unknown) => {
    cb(new Error('not found'), null);
  });
  return { execFile: mockFn, __mockExecFile: mockFn };
});

vi.mock('../../config.js', () => ({
  config: { cliPath: '/usr/bin/openclaw' },
  CLI_ENV: {},
}));

describe('getUsageCost with mocked CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zero defaults on CLI failure with no cache', async () => {
    const { getUsageCost } = await import('../system-info');
    const r = await getUsageCost();
    expect(r.totalCost).toBe(0);
    expect(r.totalTokensM).toBe(0);
    expect(r.todayCost).toBe(0);
  });
});
