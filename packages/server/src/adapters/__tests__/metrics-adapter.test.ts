// src/adapters/__tests__/metrics-adapter.test.ts
import { describe, expect, it, vi } from 'vitest';

import type { MetricsResult } from '../../ports/metrics-port.js';
import { createMetricsAdapter } from '../metrics-adapter.js';
import { testSubscribablePortContract } from './shared/subscribable-port-contract.js';

describe('MetricsAdapter', () => {
  // Mock Aggregator
  function createMockAggregator() {
    const metricsResult: MetricsResult = {
      buckets: [
        {
          label: '2026-03-03T00:00',
          errors: 5,
          warnings: 10,
          sessions: 3,
          tokens: 1000,
          apiCalls: 20,
          toolCalls: 15,
          turns: 50,
          userTurns: 25,
          assistantTurns: 25,
          modelTokens: [{ model: 'claude-4', tokensK: 1.0 }],
        },
      ],
      totalTokensK: 1.0,
      totalSessions: 3,
      totalErrors: 5,
      totalWarnings: 10,
      totalApiCalls: 20,
      totalToolCalls: 15,
      totalTurns: 50,
      range: 'TWENTY_FOUR_HOUR',
    };

    return {
      getMetrics: vi.fn(() => metricsResult),
      clearCache: vi.fn(),
      // Test helpers
      _metricsResult: metricsResult,
    };
  }

  describe('basic port contract', () => {
    it('should throw structured error for unimplemented getSessionTokens', () => {
      const aggregator = createMockAggregator();
      const adapter = createMetricsAdapter(aggregator as any);

      expect(() =>
        adapter.getSessionTokens('session-1', '2026-03-03T00:00:00.000Z', '2026-03-03T01:00:00.000Z'),
      ).toThrow();

      try {
        adapter.getSessionTokens('session-1', '2026-03-03T00:00:00.000Z', '2026-03-03T01:00:00.000Z');
      } catch (err: any) {
        expect(err.code).toBe('INVALID_STATE');
        expect(err.source).toBe('metrics-adapter');
        expect(err.retriable).toBe(false);
      }
    });

    it('should return metrics from aggregator', () => {
      const aggregator = createMockAggregator();
      const adapter = createMetricsAdapter(aggregator as any);

      const result = adapter.getMetrics();

      expect(result).toEqual(aggregator._metricsResult);
      expect(aggregator.getMetrics).toHaveBeenCalledOnce();
    });

    it('should pass date and range to aggregator', () => {
      const aggregator = createMockAggregator();
      const adapter = createMetricsAdapter(aggregator as any);

      adapter.getMetrics('2026-03-02', 'SEVEN_DAY');

      expect(aggregator.getMetrics).toHaveBeenCalledWith('2026-03-02', 'SEVEN_DAY');
    });

    it('should clear cache when clearCache is called', () => {
      const aggregator = createMockAggregator();
      const adapter = createMetricsAdapter(aggregator as any);

      adapter.clearCache();

      expect(aggregator.clearCache).toHaveBeenCalledOnce();
    });
  });

  describe('error mapping', () => {
    it('should map DB lock timeout to TIMEOUT', () => {
      const aggregator = {
        getMetrics: vi.fn(() => {
          const err = new Error('Database is locked') as Error & { code: string };
          err.code = 'SQLITE_BUSY';
          throw err;
        }),
        clearCache: vi.fn(),
      };

      const adapter = createMetricsAdapter(aggregator as any);

      expect(() => adapter.getMetrics()).toThrow();

      try {
        adapter.getMetrics();
      } catch (err: any) {
        expect(err.code).toBe('TIMEOUT');
        expect(err.source).toBe('metrics-adapter');
        expect(err.retriable).toBe(true);
      }
    });

    it('should map unknown errors to UNAVAILABLE', () => {
      const aggregator = {
        getMetrics: vi.fn(() => {
          throw new Error('Unknown database error');
        }),
        clearCache: vi.fn(),
      };

      const adapter = createMetricsAdapter(aggregator as any);

      expect(() => adapter.getMetrics()).toThrow();

      try {
        adapter.getMetrics();
      } catch (err: any) {
        expect(err.code).toBe('UNAVAILABLE');
        expect(err.source).toBe('metrics-adapter');
      }
    });
  });

  describe('subscription contract', () => {
    testSubscribablePortContract(() => {
      const aggregator = createMockAggregator();
      return createMetricsAdapter(aggregator as any);
    });

    it('should support subscribing to changes', () => {
      const aggregator = createMockAggregator();
      const adapter = createMetricsAdapter(aggregator as any);

      const callback = vi.fn();
      const unsubscribe = adapter.onChanged(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call subscribers when manually triggered', () => {
      const aggregator = createMockAggregator();
      const adapter = createMetricsAdapter(aggregator as any) as any;

      const cb1 = vi.fn();
      const cb2 = vi.fn();

      adapter.onChanged(cb1);
      adapter.onChanged(cb2);

      // Manually trigger (for testing purposes)
      if (adapter._hub) {
        adapter._hub.trigger();
      }

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  describe('destroy behavior', () => {
    it('should clear all subscriptions on destroy', () => {
      const aggregator = createMockAggregator();
      const adapter = createMetricsAdapter(aggregator as any) as any;

      const cb = vi.fn();
      adapter.onChanged(cb);

      adapter.destroy();

      // Trigger after destroy should not call callback
      if (adapter._hub) {
        adapter._hub.trigger();
      }
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
