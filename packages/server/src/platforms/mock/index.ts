// src/platforms/mock/index.ts
import type { CliAdapter, Platform, ProcessAdapter } from '../../ports/types.js';

export function createMockProcessAdapter(overrides?: Partial<ProcessAdapter>): ProcessAdapter {
  return {
    getPid: () => Promise.resolve(12345),
    getProcessMetrics: () => Promise.resolve({ cpu: 5.0, memoryMB: 256 }),
    getUptime: () => Promise.resolve('2h 30m'),
    findPidByPort: () => Promise.resolve(null),
    getDiskMB: () => Promise.resolve(128),
    ...overrides,
  };
}

export function createMockCliAdapter(overrides?: Partial<CliAdapter>): CliAdapter {
  return {
    exec: () => Promise.resolve(''),
    ...overrides,
  };
}

export function createMockPlatform(overrides?: {
  process?: Partial<ProcessAdapter>;
  cli?: Partial<CliAdapter>;
}): Platform {
  return {
    process: createMockProcessAdapter(overrides?.process),
    cli: createMockCliAdapter(overrides?.cli),
  };
}
