// src/adapters/__tests__/system-adapter.test.ts
import { describe, expect, it, vi } from 'vitest';

import { getAppVersion } from '../../version.js';
import {
  aggregateHealthStatus,
  createSystemAdapter,
  mapChannels,
  mapGateway,
  mapHealthStatus,
  mapResources,
  mapSystemMetrics,
} from '../system-adapter.js';

describe('SystemAdapter', () => {
  function createMockService() {
    return {
      getSystemMetrics: vi.fn(async () => ({
        cpu: 12.5,
        memoryMB: 512,
        diskMB: 2048,
        sampledAt: '2026-03-04T00:00:00.000Z',
      })),
      getUsageCost: vi.fn(async () => ({
        totalCost: 0,
        totalTokensM: 0,
        todayCost: 0,
        todayTokensM: 0,
        fetchedAt: '2026-03-04T00:00:00.000Z',
      })),
      resetMetricsCache: vi.fn(),
      resetCostCache: vi.fn(),
    };
  }

  function createMockPlatform() {
    return {
      process: {
        getPid: vi.fn(async () => 12345),
        getProcessMetrics: vi.fn(
          async (_pid: number): Promise<{ cpu: number; memoryMB: number } | null> => ({ cpu: 5.5, memoryMB: 128 }),
        ),
        getUptime: vi.fn(async () => '1h'),
        findPidByPort: vi.fn(async () => 12345),
        getDiskMB: vi.fn(async () => 2048),
      },
      cli: {
        exec: vi.fn(async () => ''),
      },
    };
  }

  it('should return system metrics from service', async () => {
    const service = createMockService();
    const platform = createMockPlatform();
    const adapter = createSystemAdapter(service as any, platform as any);

    const result = await adapter.getSystemMetrics();

    expect(result.cpu).toBe(12.5);
    expect(result.memoryMB).toBe(512);
    expect(result.diskMB).toBe(2048);
    expect(result.uptime).toMatch(/^\d+s$/);
    expect(result.platform).toBe(process.platform);
    expect(result.nodeVersion).toBe(process.version);
    expect(service.getSystemMetrics).toHaveBeenCalledOnce();
  });

  it('should return process metrics for valid PID', async () => {
    const service = createMockService();
    const platform = createMockPlatform();
    const adapter = createSystemAdapter(service as any, platform as any);

    const result = await adapter.getProcessMetrics(12345);

    expect(result).toEqual({ cpu: 5.5, memoryMB: 128 });
    expect(platform.process.getProcessMetrics).toHaveBeenCalledWith(12345);
  });

  it('should return null for non-existent PID', async () => {
    const service = createMockService();
    const platform = createMockPlatform();
    platform.process.getProcessMetrics = vi.fn(
      async (_pid: number): Promise<{ cpu: number; memoryMB: number } | null> => null,
    );
    const adapter = createSystemAdapter(service as any, platform as any);

    const result = await adapter.getProcessMetrics(99999);

    expect(result).toBeNull();
    expect(platform.process.getProcessMetrics).toHaveBeenCalledWith(99999);
  });

  describe('mapping helpers', () => {
    it('maps gateway with v1-compatible semantics', () => {
      const mapped = mapGateway({
        running: true,
        pid: 4321,
        version: '1.2.3',
        updateAvailable: null,
        uptime: '2h',
        startedAt: '2026-03-04T00:00:00.000Z',
        channels: [],
        connectLatencyMs: 20,
        latestVersion: '1.2.3',
        securitySummary: { critical: 1, warn: 2, info: 3 },
        sessionDefaults: null,
      });

      expect(mapped.securityCritical).toBe(1);
      expect(mapped.securityWarn).toBe(2);
      expect(mapped.appVersion).toBe(getAppVersion());
    });

    it('maps channels with unknown fallback and connected flag', () => {
      const mapped = mapChannels({
        channels: [
          {
            provider: 'telegram',
            name: null,
            connected: true,
            latencyMs: null,
          },
        ],
      });

      expect(mapped).toEqual([{ provider: 'telegram', name: 'unknown', connected: true, latencyMs: null }]);
    });

    it('maps resources and emits sampledAt', () => {
      const mapped = mapResources({ cpu: 1, memoryMB: 2, diskMB: 3 });
      expect(mapped.cpu).toBe(1);
      expect(mapped.memoryMB).toBe(2);
      expect(mapped.diskMB).toBe(3);
      expect(typeof mapped.sampledAt).toBe('string');
    });

    it('maps system metrics with required contract fields', () => {
      const mapped = mapSystemMetrics({ cpu: 10, memoryMB: 20, diskMB: 30 });
      expect(mapped.cpu).toBe(10);
      expect(mapped.memoryMB).toBe(20);
      expect(mapped.diskMB).toBe(30);
      expect(mapped.uptime).toMatch(/\d+s/);
      expect(mapped.platform).toBe(process.platform);
      expect(mapped.nodeVersion).toBe(process.version);
    });
  });

  describe('mapHealthStatus', () => {
    it.each([
      ['ok', 'HEALTHY'],
      ['connected', 'HEALTHY'],
      ['PASS', 'HEALTHY'],
      ['healthy', 'HEALTHY'],
      ['warn', 'DEGRADED'],
      ['WARNING', 'DEGRADED'],
      ['pending', 'DEGRADED'],
      ['starting', 'DEGRADED'],
      ['degraded', 'DEGRADED'],
      ['FAIL', 'UNHEALTHY'],
      ['error', 'UNHEALTHY'],
      ['disconnected', 'UNHEALTHY'],
      ['unhealthy', 'UNHEALTHY'],
    ])('maps %s → %s', (input, expected) => {
      expect(mapHealthStatus(input)).toBe(expected);
    });

    it('returns DEGRADED for null/undefined', () => {
      expect(mapHealthStatus(null)).toBe('DEGRADED');
      expect(mapHealthStatus(undefined)).toBe('DEGRADED');
    });

    it('returns fallback for unrecognised strings', () => {
      expect(mapHealthStatus('banana')).toBe('DEGRADED');
      expect(mapHealthStatus('banana', 'UNHEALTHY')).toBe('UNHEALTHY');
    });

    it('trims and is case-insensitive', () => {
      expect(mapHealthStatus('  OK  ')).toBe('HEALTHY');
      expect(mapHealthStatus('Pass')).toBe('HEALTHY');
    });
  });

  describe('aggregateHealthStatus', () => {
    it('returns HEALTHY when all healthy', () => {
      expect(aggregateHealthStatus(['HEALTHY', 'HEALTHY'])).toBe('HEALTHY');
    });

    it('returns DEGRADED when any degraded', () => {
      expect(aggregateHealthStatus(['HEALTHY', 'DEGRADED'])).toBe('DEGRADED');
    });

    it('returns UNHEALTHY when any unhealthy', () => {
      expect(aggregateHealthStatus(['HEALTHY', 'DEGRADED', 'UNHEALTHY'])).toBe('UNHEALTHY');
    });

    it('returns DEGRADED for empty array', () => {
      expect(aggregateHealthStatus([])).toBe('DEGRADED');
    });
  });

  describe('error mapping', () => {
    it('should map ENOENT to NOT_FOUND', async () => {
      const service = createMockService();
      service.getSystemMetrics = vi.fn(async () => {
        const err = new Error('Not found') as Error & { code: string };
        err.code = 'ENOENT';
        throw err;
      });
      const platform = createMockPlatform();
      const adapter = createSystemAdapter(service as any, platform as any);

      await expect(adapter.getSystemMetrics()).rejects.toThrow();

      try {
        await adapter.getSystemMetrics();
      } catch (err: any) {
        expect(err.code).toBe('NOT_FOUND');
        expect(err.source).toBe('system-adapter');
      }
    });

    it('should map generic errors to UNAVAILABLE', async () => {
      const service = createMockService();
      const platform = createMockPlatform();
      platform.process.getProcessMetrics = vi.fn(async () => {
        throw new Error('Unexpected failure');
      });
      const adapter = createSystemAdapter(service as any, platform as any);

      await expect(adapter.getProcessMetrics(12345)).rejects.toThrow();

      try {
        await adapter.getProcessMetrics(12345);
      } catch (err: any) {
        expect(err.code).toBe('UNAVAILABLE');
        expect(err.source).toBe('system-adapter');
      }
    });
  });
});
