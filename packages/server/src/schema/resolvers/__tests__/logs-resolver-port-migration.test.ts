import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import type { LogPort } from '../../../ports/log-port';
import { usageResolvers } from '../usage.resolver';

describe('usage.resolver - recentLogs Port Migration', () => {
  let ctx: AppContext;
  let logPortMock: LogPort;
  let capturedContexts: any[];

  beforeEach(() => {
    capturedContexts = [];

    // Mock LogPort with spy to capture ReadContext
    logPortMock = {
      getRecentLogs: vi.fn((limit, context) => {
        capturedContexts.push(context);
        return [
          {
            timestamp: 1709500000000,
            level: 'info',
            source: 'server',
            message: 'Server started',
          },
        ];
      }),
      getLogsInRange: vi.fn(),
      onChanged: vi.fn(() => () => {}),
    } as unknown as LogPort;

    ctx = {
      ports: {
        sessions: {} as any,
        metrics: {} as any,
        gateway: {} as any,
        cron: {} as any,
        logs: logPortMock,
        system: {} as any,
      },
      // Legacy accessor for usageCost (not migrated in this task)
      systemInfoService: {
        getUsageCost: vi.fn().mockResolvedValue({ totalCostUsd: 1.5 }),
      },
      // Legacy fields should NOT be accessed for recentLogs
      logTailer: {
        getRecentEntries: vi.fn(),
      },
    } as unknown as AppContext;
  });

  describe('ReadContext creation and reuse', () => {
    it('creates ReadContext once per request and passes it to LogPort', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      Query.recentLogs!({}, { count: 10 });

      // Verify port was called
      expect(logPortMock.getRecentLogs).toHaveBeenCalledTimes(1);

      // Verify a ReadContext was passed
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0]).toBeDefined();
      expect(capturedContexts[0]).toHaveProperty('requestId');
      expect(capturedContexts[0]).toHaveProperty('asOfTs');
    });

    it('verifies asOfTs is a plain field, not a getter', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      Query.recentLogs!({}, {});

      const passedContext = capturedContexts[0];
      const descriptor = Object.getOwnPropertyDescriptor(passedContext, 'asOfTs');

      // Must be a plain data field, not a getter
      expect(descriptor).toBeDefined();
      expect(descriptor?.get).toBeUndefined();
      expect(descriptor?.value).toBeTypeOf('number');
    });

    it('verifies requestId is a non-empty string', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      Query.recentLogs!({}, {});

      const requestId = capturedContexts[0]?.requestId;
      expect(requestId).toBeTypeOf('string');
      expect(requestId.length).toBeGreaterThan(0);
    });
  });

  describe('No legacy context reads for recentLogs', () => {
    it('does NOT call ctx.logTailer methods', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      Query.recentLogs!({}, { count: 10 });

      // Legacy methods should NOT be touched
      expect(ctx.logTailer.getRecentEntries).not.toHaveBeenCalled();
    });

    it('uses ctx.ports.logs instead of ctx.logTailer', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      Query.recentLogs!({}, {});

      // Port method should be called
      expect(logPortMock.getRecentLogs).toHaveBeenCalled();
    });
  });

  describe('Behavior parity - LogEntry mapping', () => {
    it('maps port LogEntry.timestamp (number) to GraphQL LogEntry.time (ISO string)', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.recentLogs!({}, {}) as any[];

      expect(result[0].time).toBe('2024-03-03T21:06:40.000Z');
    });

    it('maps port LogEntry.source to GraphQL LogEntry.module', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.recentLogs!({}, {}) as any[];

      expect(result[0].module).toBe('server');
    });

    it('preserves level and message fields', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.recentLogs!({}, {}) as any[];

      expect(result[0].level).toBe('INFO');
      expect(result[0].message).toBe('Server started');
    });

    it('passes count argument to port', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      Query.recentLogs!({}, { count: 25 });

      expect(logPortMock.getRecentLogs).toHaveBeenCalledWith(25, expect.any(Object));
    });

    it('defaults count to 50 when not provided', () => {
      const resolvers = usageResolvers(ctx);
      const Query = resolvers.Query!;

      Query.recentLogs!({}, {});

      expect(logPortMock.getRecentLogs).toHaveBeenCalledWith(50, expect.any(Object));
    });
  });
});
