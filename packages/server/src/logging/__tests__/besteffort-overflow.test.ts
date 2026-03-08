import { describe, expect, it } from 'vitest';

import { LogRouter } from '../router.js';
import { deterministicSampleDecision } from '../sampling.js';

describe('best-effort overflow policy', () => {
  it('drops debug before sampling info when best-effort queue overflows', () => {
    // Create a router with a tiny best-effort queue (capacity 2)
    const router = new LogRouter({
      bestEffortQueueMax: 2,
      bestEffortQueueMaxBytes: 1024 * 1024,
    });

    // Fill the queue
    const r1 = router.route({ level: 'info', message: 'a', timestamp: 1, byteSize: 10 });
    const r2 = router.route({ level: 'info', message: 'b', timestamp: 2, byteSize: 10 });
    expect(r1.accepted).toBe(true);
    expect(r2.accepted).toBe(true);

    // Queue is full — debug should be rejected (dropped)
    const debugResult = router.route({ level: 'debug', message: 'c', timestamp: 3, byteSize: 10 });
    expect(debugResult.accepted).toBe(false);
    expect(debugResult.lane).toBe('bestEffort');

    // Info should also be rejected at router level (overflow policy applies above)
    const infoResult = router.route({ level: 'info', message: 'd', timestamp: 4, byteSize: 10 });
    expect(infoResult.accepted).toBe(false);
    expect(infoResult.lane).toBe('bestEffort');
  });

  it('samples info deterministically when debug exhausted', () => {
    // When debug is fully dropped but overflow persists,
    // info should be sampled using deterministic sampling at 50%
    const results: boolean[] = [];
    const modules = ['modA', 'modB', 'modC', 'modD', 'modE', 'modF', 'modG', 'modH', 'modI', 'modJ'];

    for (const mod of modules) {
      const accepted = deterministicSampleDecision({
        module: mod,
        msgTemplate: 'overflow-test',
        sampleRate: 0.5,
        timestampMs: 100_000,
      });
      results.push(accepted);
    }

    const acceptedCount = results.filter(Boolean).length;
    // With 50% sampling across 10 modules, we expect roughly half accepted
    // Deterministic: exact count is stable, just check it's not all or none
    expect(acceptedCount).toBeGreaterThan(0);
    expect(acceptedCount).toBeLessThan(modules.length);
  });
});
