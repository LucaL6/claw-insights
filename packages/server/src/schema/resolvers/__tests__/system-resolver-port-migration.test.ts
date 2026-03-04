import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import type { SystemPort } from '../../../ports/system-port';
import { gatewayResolvers } from '../gateway.resolver';

describe('gateway.resolver - resources Port Migration', () => {
  let ctx: AppContext;
  let systemPortMock: SystemPort;
  let capturedContexts: any[];

  beforeEach(() => {
    capturedContexts = [];

    // Mock SystemPort with spy to capture ReadContext
    systemPortMock = {
      getSystemMetrics: vi.fn(async (context) => {
        capturedContexts.push(context);
        return {
          cpu: 25.5,
          memoryMB: 512,
          diskMB: 1024,
          uptime: '3600s',
          platform: 'darwin',
          nodeVersion: 'v20.0.0',
        };
      }),
      getProcessMetrics: vi.fn(),
    } as unknown as SystemPort;

    ctx = {
      ports: {
        sessions: {} as any,
        metrics: {} as any,
        gateway: {
          getGatewayStatus: vi.fn().mockResolvedValue({
            running: true,
            pid: 1234,
            version: '1.0.0',
            updateAvailable: null,
            uptime: '2h',
            startedAt: '2025-01-01T00:00:00Z',
            connectLatencyMs: 42,
            latestVersion: '1.0.0',
            securitySummary: { critical: 0, warn: 1, info: 0 },
            channels: [],
            sessionDefaults: null,
          }),
          getVersion: vi.fn().mockResolvedValue('1.0.0'),
          warmCache: vi.fn().mockResolvedValue(undefined),
        },
        cron: {} as any,
        logs: {} as any,
        system: systemPortMock,
      },
      // Legacy fields should NOT be accessed for resources
      systemInfoService: {
        getSystemMetrics: vi.fn(),
        getUsageCost: vi.fn(),
      },
    } as unknown as AppContext;
  });

  describe('ReadContext creation and reuse', () => {
    it('creates ReadContext once per request and passes it to SystemPort', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.resources!({}, {});

      // Verify port was called
      expect(systemPortMock.getSystemMetrics).toHaveBeenCalledTimes(1);

      // Verify a ReadContext was passed
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0]).toBeDefined();
      expect(capturedContexts[0]).toHaveProperty('requestId');
      expect(capturedContexts[0]).toHaveProperty('asOfTs');
    });

    it('verifies asOfTs is a plain field, not a getter', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.resources!({}, {});

      const passedContext = capturedContexts[0];
      const descriptor = Object.getOwnPropertyDescriptor(passedContext, 'asOfTs');

      // Must be a plain data field, not a getter
      expect(descriptor).toBeDefined();
      expect(descriptor?.get).toBeUndefined();
      expect(descriptor?.value).toBeTypeOf('number');
    });

    it('verifies requestId is a non-empty string', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.resources!({}, {});

      const requestId = capturedContexts[0]?.requestId;
      expect(requestId).toBeTypeOf('string');
      expect(requestId.length).toBeGreaterThan(0);
    });
  });

  describe('No legacy context reads for resources', () => {
    it('does NOT call ctx.systemInfoService methods', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.resources!({}, {});

      // Legacy methods should NOT be touched
      expect(ctx.systemInfoService.getSystemMetrics).not.toHaveBeenCalled();
    });

    it('uses ctx.ports.system instead of ctx.systemInfoService', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.resources!({}, {});

      // Port method should be called
      expect(systemPortMock.getSystemMetrics).toHaveBeenCalled();
    });
  });

  describe('Behavior parity - SystemMetrics to SystemResources mapping', () => {
    it('maps cpu correctly', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      const result = (await Query.resources!({}, {})) as any;

      expect(result.cpu).toBe(25.5);
    });

    it('maps memoryMB correctly', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      const result = (await Query.resources!({}, {})) as any;

      expect(result.memoryMB).toBe(512);
    });

    it('maps diskMB correctly', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      const result = (await Query.resources!({}, {})) as any;

      expect(result.diskMB).toBe(1024);
    });

    it('adds sampledAt as ISO timestamp', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      const beforeCall = new Date().toISOString();
      const result = (await Query.resources!({}, {})) as any;
      const afterCall = new Date().toISOString();

      // sampledAt should be an ISO string timestamp
      expect(result.sampledAt).toBeDefined();
      expect(typeof result.sampledAt).toBe('string');
      // Should be a valid ISO date
      expect(() => new Date(result.sampledAt)).not.toThrow();
      // Should be between before and after the call
      expect(result.sampledAt >= beforeCall).toBe(true);
      expect(result.sampledAt <= afterCall).toBe(true);
    });
  });
});
