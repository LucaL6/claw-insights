import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPlatform } from '../../platforms/mock/index.js';
import type { Platform } from '../../ports/types.js';
import { createSystemInfoService, type SystemInfoService } from '../system-info.js';

describe('createSystemInfoService', () => {
  let platform: Platform;
  let service: SystemInfoService;

  beforeEach(() => {
    platform = createMockPlatform({
      process: {
        getPid: vi.fn().mockResolvedValue(12345),
        getProcessMetrics: vi.fn().mockResolvedValue({ cpu: 5.0, memoryMB: 256 }),
        getDiskMB: vi.fn().mockResolvedValue(128),
      },
    });
    service = createSystemInfoService(platform);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe('getSystemMetrics', () => {
    it('calls process.getPid + getProcessMetrics + getDiskMB', async () => {
      const result = await service.getSystemMetrics();
      expect(platform.process.getPid).toHaveBeenCalled();
      expect(platform.process.getProcessMetrics).toHaveBeenCalledWith(12345);
      expect(platform.process.getDiskMB).toHaveBeenCalled();
      expect(result.cpu).toBe(5.0);
      expect(result.memoryMB).toBe(256);
      expect(result.diskMB).toBe(128);
      expect(result.sampledAt).toBeTruthy();
    });

    it('returns cpu/memoryMB = 0 when pid is null', async () => {
      platform = createMockPlatform({ process: { getPid: () => Promise.resolve(null) } });
      service = createSystemInfoService(platform);
      const result = await service.getSystemMetrics();
      expect(result.cpu).toBe(0);
      expect(result.memoryMB).toBe(0);
    });

    it('returns cached data within TTL', async () => {
      const first = await service.getSystemMetrics();
      const second = await service.getSystemMetrics();
      expect(first).toBe(second);
      // getPid called only once
      expect(platform.process.getPid).toHaveBeenCalledTimes(1);
    });

    it('returns demo values when env vars set', async () => {
      vi.stubEnv('CLAW_INSIGHTS_DEMO_CPU', '42.5');
      vi.stubEnv('CLAW_INSIGHTS_DEMO_MEM', '1024');
      service = createSystemInfoService(platform);
      const result = await service.getSystemMetrics();
      expect(result.cpu).toBe(42.5);
      expect(result.memoryMB).toBe(1024);
      expect(result.diskMB).toBe(0);
      expect(platform.process.getPid).not.toHaveBeenCalled();
    });
  });

  describe('getUsageCost', () => {
    it('calls cli.exec and parses output', async () => {
      platform = createMockPlatform({
        cli: {
          exec: vi.fn().mockResolvedValue('Total: $12.50 · 3.2m tokens\nLatest day: 2026-02-18 $1.50 · 0.8m tokens'),
        },
      });
      service = createSystemInfoService(platform);
      const result = await service.getUsageCost();
      expect(platform.cli.exec).toHaveBeenCalledWith(['gateway', 'usage-cost']);
      expect(result.totalCost).toBe(12.5);
      expect(result.todayCost).toBe(1.5);
    });

    it('returns cached data within TTL', async () => {
      platform = createMockPlatform({
        cli: {
          exec: vi.fn().mockResolvedValue('Total: $12.50 · 3.2m tokens\nLatest day: 2026-02-18 $1.50 · 0.8m tokens'),
        },
      });
      service = createSystemInfoService(platform);
      const first = await service.getUsageCost();
      const second = await service.getUsageCost();
      expect(first).toBe(second);
      expect(platform.cli.exec).toHaveBeenCalledTimes(1);
    });

    it('returns cached data on CLI failure when cache exists', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-28T00:00:00.000Z'));

      const execMock = vi
        .fn()
        .mockResolvedValueOnce('Total: $12.50 · 3.2m tokens\nLatest day: 2026-02-18 $1.50 · 0.8m tokens')
        .mockResolvedValueOnce('');
      platform = createMockPlatform({ cli: { exec: execMock } });
      service = createSystemInfoService(platform);

      const first = await service.getUsageCost();
      expect(first.totalCost).toBe(12.5);

      // Expire cache by manipulating time
      vi.setSystemTime(new Date('2026-02-28T00:06:00.000Z')); // past 5min TTL
      const second = await service.getUsageCost();
      // CLI returned empty → fallback to cached data
      expect(second.totalCost).toBe(12.5);
    });

    it('returns zeros on CLI failure without cache', async () => {
      platform = createMockPlatform({
        cli: { exec: vi.fn().mockResolvedValue('') },
      });
      service = createSystemInfoService(platform);
      const result = await service.getUsageCost();
      expect(result.totalCost).toBe(0);
      expect(result.todayCost).toBe(0);
    });
  });
});
