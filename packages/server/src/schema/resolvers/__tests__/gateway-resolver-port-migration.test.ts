import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import type { GatewayPort, GatewayStatus } from '../../../ports/gateway-port';
import { gatewayResolvers } from '../gateway.resolver';

const mockGatewayStatus: GatewayStatus = {
  running: true,
  pid: 1234,
  version: '1.0.0',
  updateAvailable: null,
  uptime: '2h',
  startedAt: '2025-01-01T00:00:00Z',
  connectLatencyMs: 42,
  latestVersion: '1.0.0',
  securitySummary: { critical: 0, warn: 1, info: 0 },
  channels: [
    {
      type: 'discord',
      accountId: 'acc1',
      protocol: 'ws',
      profile: null,
      name: 'general',
      connectionStatus: 'connected',
    },
  ],
  sessionDefaults: null,
};

describe('gateway.resolver - Port Migration', () => {
  let ctx: AppContext;
  let gatewayPortMock: GatewayPort;
  let capturedContexts: any[];

  beforeEach(() => {
    capturedContexts = [];

    // Mock GatewayPort with spy to capture ReadContext
    gatewayPortMock = {
      getGatewayStatus: vi.fn(async (context) => {
        capturedContexts.push(context);
        return mockGatewayStatus;
      }),
      getVersion: vi.fn(async (context) => {
        capturedContexts.push(context);
        return '1.0.0';
      }),
      warmCache: vi.fn(async () => {}),
    } as unknown as GatewayPort;

    ctx = {
      ports: {
        sessions: {} as any,
        metrics: {} as any,
        gateway: gatewayPortMock,
        cron: undefined,
        logs: undefined,
        system: undefined,
      },
      systemInfoService: {
        getSystemMetrics: vi.fn().mockResolvedValue({ cpu: 25, memoryMB: 512 }),
      },
      // Legacy field should NOT be accessed
      gatewayClient: {
        getGatewayStatus: vi.fn(),
        getVersion: vi.fn(),
      },
    } as unknown as AppContext;
  });

  describe('ReadContext creation and reuse', () => {
    it('creates ReadContext once per request for gateway resolver', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.gateway!({}, {});

      // Verify port was called
      expect(gatewayPortMock.getGatewayStatus).toHaveBeenCalledTimes(1);

      // Verify a ReadContext was passed
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0]).toBeDefined();
      expect(capturedContexts[0]).toHaveProperty('requestId');
      expect(capturedContexts[0]).toHaveProperty('asOfTs');
    });

    it('verifies asOfTs is a plain field, not a getter', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.gateway!({}, {});

      const passedContext = capturedContexts[0];
      const descriptor = Object.getOwnPropertyDescriptor(passedContext, 'asOfTs');

      // Must be a plain data field, not a getter
      expect(descriptor).toBeDefined();
      expect(descriptor?.get).toBeUndefined();
      expect(descriptor?.value).toBeTypeOf('number');
    });

    it('creates ReadContext once per request for channels resolver', async () => {
      capturedContexts = []; // Reset
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.channels!({}, {});

      expect(gatewayPortMock.getGatewayStatus).toHaveBeenCalledTimes(1);
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0]).toHaveProperty('requestId');
    });

    it('verifies requestId is consistent', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.gateway!({}, {});

      const firstRequestId = capturedContexts[0]?.requestId;
      expect(firstRequestId).toBeTypeOf('string');
      expect(firstRequestId.length).toBeGreaterThan(0);
    });
  });

  describe('No legacy context reads', () => {
    it('does NOT call ctx.gatewayClient methods in gateway resolver', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.gateway!({}, {});

      // Legacy methods should NOT be touched
      expect(ctx.gatewayClient.getGatewayStatus).not.toHaveBeenCalled();
    });

    it('does NOT call ctx.gatewayClient methods in channels resolver', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.channels!({}, {});

      expect(ctx.gatewayClient.getGatewayStatus).not.toHaveBeenCalled();
    });

    it('uses ctx.ports.gateway instead of ctx.gatewayClient', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      await Query.gateway!({}, {});

      // Port method should be called
      expect(gatewayPortMock.getGatewayStatus).toHaveBeenCalled();
    });
  });

  describe('Behavior parity', () => {
    it('maps gateway status fields correctly', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      const result = await Query.gateway!({}, {});

      expect(result).toMatchObject({
        running: true,
        pid: 1234,
        version: '1.0.0',
        securityCritical: 0,
        securityWarn: 1,
        uptime: '2h',
      });
    });

    it('includes appVersion from getAppVersion', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      const result = await Query.gateway!({}, {});

      expect(result).toHaveProperty('appVersion');
      expect(typeof result.appVersion).toBe('string');
    });

    it('returns channels from status with proper mapping', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      const result = await Query.channels!({}, {});

      // Verify mapping from ChannelInfo to GraphQL Channel type
      expect(result).toEqual([
        {
          provider: 'discord',
          name: 'general',
          connected: true,
          latencyMs: null,
        },
      ]);
    });

    it('resources resolver still uses ctx.systemInfoService (not migrated yet)', async () => {
      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      const result = await Query.resources!({}, {});

      // This one is NOT migrated in Task 6, should still use old path
      expect(ctx.systemInfoService.getSystemMetrics).toHaveBeenCalled();
      expect(result).toMatchObject({ cpu: 25, memoryMB: 512 });
    });

    it('handles errors gracefully with safe() wrapper', async () => {
      gatewayPortMock.getGatewayStatus = vi.fn().mockRejectedValue(new Error('boom'));

      const resolvers = gatewayResolvers(ctx);
      const Query = resolvers.Query!;

      // safe() should catch error and throw GraphQLError
      await expect(Query.gateway!({}, {})).rejects.toThrow('boom');
    });
  });
});
