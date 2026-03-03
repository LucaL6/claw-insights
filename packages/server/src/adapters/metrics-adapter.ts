// src/adapters/metrics-adapter.ts
import { mapInfraError } from '../ports/error-mapping.js';
import { createPortError } from '../ports/errors.js';
import type { MetricsPort, MetricsRangeKey, MetricsResult } from '../ports/metrics-port.js';
import type { ReadContext, Unsubscribe } from '../ports/shared.js';
import type { Aggregator } from '../sources/aggregator.js';
import { createSubscriptionHub } from './shared/subscription-hub.js';

const SOURCE = 'metrics-adapter';

/**
 * Create a MetricsPort adapter that wraps Aggregator.
 *
 * Aggregator has no built-in change notification, so we provide
 * a manual subscription mechanism via hub.
 *
 * @param aggregator - Aggregator instance
 * @returns MetricsPort implementation
 */
export function createMetricsAdapter(aggregator: Aggregator): MetricsPort & { destroy: () => void; _hub?: unknown } {
  const hub = createSubscriptionHub();

  function getMetrics(
    date?: string,
    range: MetricsRangeKey = 'TWENTY_FOUR_HOUR',
    _context?: ReadContext,
  ): MetricsResult {
    try {
      const result = aggregator.getMetrics(date, range);
      return result as MetricsResult;
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function getSessionTokens(_sessionId: string, _start: string, _end: string, _context?: ReadContext): number {
    throw createPortError('INVALID_STATE', SOURCE, 'getSessionTokens is not implemented in metrics-adapter yet');
  }

  function clearCache(): void {
    try {
      aggregator.clearCache();
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function onChanged(callback: () => void): Unsubscribe {
    return hub.subscribe(callback);
  }

  function destroy(): void {
    hub.destroy();
  }

  return {
    getMetrics,
    getSessionTokens,
    clearCache,
    onChanged,
    destroy,
    _hub: hub, // Expose for testing
  };
}
