import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import type { MetricsPort } from '../../../ports/metrics-port';
import { metricsResolvers } from '../metrics.resolver';

describe('metrics.resolver - Port Migration', () => {
  let ctx: AppContext;
  let metricsPortMock: MetricsPort;
  let capturedContexts: any[];

  beforeEach(() => {
    capturedContexts = [];

    // Mock MetricsPort with spy to capture ReadContext
    metricsPortMock = {
      getMetrics: vi.fn((date, range, context) => {
        capturedContexts.push(context);
        return {
          buckets: [],
          totalTokensK: 100,
          totalSessions: 5,
          totalErrors: 2,
          totalWarnings: 3,
          totalApiCalls: 50,
          totalToolCalls: 25,
          totalTurns: 100,
          range: range || 'TWENTY_FOUR_HOUR',
        };
      }),
      getSessionTokens: vi.fn((sessionId, start, end, context) => {
        capturedContexts.push(context);
        return 42;
      }),
      clearCache: vi.fn(),
      onChanged: vi.fn(() => () => {}),
    } as unknown as MetricsPort;

    ctx = {
      ports: {
        sessions: {} as any,
        metrics: metricsPortMock,
        gateway: {} as any,
        cron: undefined,
        logs: undefined,
        system: undefined,
      },
      dataValidator: {
        runValidation: vi.fn().mockReturnValue([
          { pass: true, message: 'ok' },
          { pass: false, message: 'stale data' },
        ]),
      },
      // Legacy field should NOT be accessed
      aggregator: {
        getMetrics: vi.fn(),
      },
    } as unknown as AppContext;
  });

  describe('ReadContext creation and reuse', () => {
    it('creates ReadContext once per request and passes it to Port', () => {
      const resolvers = metricsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.metrics!({}, { range: 'ONE_HOUR' });

      // Verify port was called
      expect(metricsPortMock.getMetrics).toHaveBeenCalledTimes(1);

      // Verify a ReadContext was passed
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0]).toBeDefined();
      expect(capturedContexts[0]).toHaveProperty('requestId');
      expect(capturedContexts[0]).toHaveProperty('asOfTs');
    });

    it('verifies asOfTs is a plain field, not a getter', () => {
      const resolvers = metricsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.metrics!({}, { range: 'ONE_HOUR' });

      const passedContext = capturedContexts[0];
      const descriptor = Object.getOwnPropertyDescriptor(passedContext, 'asOfTs');

      // Must be a plain data field, not a getter
      expect(descriptor).toBeDefined();
      expect(descriptor?.get).toBeUndefined();
      expect(descriptor?.value).toBeTypeOf('number');
    });

    it('verifies requestId is consistent', () => {
      const resolvers = metricsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.metrics!({}, { range: 'ONE_HOUR' });

      const firstRequestId = capturedContexts[0]?.requestId;
      expect(firstRequestId).toBeTypeOf('string');
      expect(firstRequestId.length).toBeGreaterThan(0);
    });
  });

  describe('No legacy context reads', () => {
    it('does NOT call ctx.aggregator methods', () => {
      const resolvers = metricsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.metrics!({}, { range: 'ONE_HOUR' });

      // Legacy methods should NOT be touched
      expect(ctx.aggregator.getMetrics).not.toHaveBeenCalled();
    });

    it('uses ctx.ports.metrics instead of ctx.aggregator', () => {
      const resolvers = metricsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.metrics!({}, { range: 'ONE_HOUR' });

      // Port method should be called
      expect(metricsPortMock.getMetrics).toHaveBeenCalled();
    });
  });

  describe('Behavior parity', () => {
    it('still includes validation warnings in result', () => {
      const resolvers = metricsResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.metrics!({}, { range: 'ONE_HOUR' });

      expect(ctx.dataValidator.runValidation).toHaveBeenCalled();
      expect(result).toHaveProperty('warnings');
      expect(result.warnings).toEqual(['stale data']);
    });

    it('defaults to TWENTY_FOUR_HOUR for invalid range', () => {
      const resolvers = metricsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.metrics!({}, { range: 'INVALID' });

      expect(metricsPortMock.getMetrics).toHaveBeenCalledWith(undefined, 'TWENTY_FOUR_HOUR', expect.anything());
    });

    it('passes date and range arguments correctly', () => {
      const resolvers = metricsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.metrics!({}, { range: 'ONE_HOUR', date: '2025-01-01' });

      expect(metricsPortMock.getMetrics).toHaveBeenCalledWith('2025-01-01', 'ONE_HOUR', expect.anything());
    });

    it('returns the same shape of data as before', () => {
      const resolvers = metricsResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.metrics!({}, { range: 'ONE_HOUR' });

      expect(result).toMatchObject({
        totalTokensK: 100,
        totalSessions: 5,
        warnings: expect.any(Array),
      });
    });
  });
});
