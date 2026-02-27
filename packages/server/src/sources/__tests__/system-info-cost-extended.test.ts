import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Platform } from '../../ports/types.js';
import { createSystemInfoService } from '../system-info.js';

describe('getUsageCost with mocked CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero defaults on CLI failure with no cache', async () => {
    const platform = {
      cli: { exec: vi.fn(() => Promise.resolve('')) },
      process: {
        getPid: vi.fn(() => Promise.resolve(null)),
        getProcessMetrics: vi.fn(() => Promise.resolve(null)),
        getDiskMB: vi.fn(() => Promise.resolve(0)),
        findPidByPort: vi.fn(() => Promise.resolve(null)),
        getUptime: vi.fn(() => Promise.resolve('unknown')),
      },
    } as unknown as Platform;

    const svc = createSystemInfoService(platform);
    const r = await svc.getUsageCost();
    expect(r.totalCost).toBe(0);
    expect(r.totalTokensM).toBe(0);
    expect(r.todayCost).toBe(0);
  });
});
