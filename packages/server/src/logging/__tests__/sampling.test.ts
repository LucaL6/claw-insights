import { describe, expect, it } from 'vitest';

import { deterministicSampleDecision, minuteBucket } from '../sampling.js';

describe('deterministic sampling', () => {
  it('is stable for same module/template/minute bucket', () => {
    const timestamp = 1_710_000_000_000;

    const first = deterministicSampleDecision({
      module: 'collector',
      msgTemplate: 'poll finished',
      sampleRate: 0.25,
      timestampMs: timestamp,
    });

    const second = deterministicSampleDecision({
      module: 'collector',
      msgTemplate: 'poll finished',
      sampleRate: 0.25,
      timestampMs: timestamp + 20_000,
    });

    expect(minuteBucket(timestamp)).toBe(minuteBucket(timestamp + 20_000));
    expect(second).toBe(first);
  });

  it('can change once minute bucket changes', () => {
    const timestamp = 1_710_000_000_000;

    const current = deterministicSampleDecision({
      module: 'router',
      msgTemplate: 'skip best effort record',
      sampleRate: 0.5,
      timestampMs: timestamp,
    });

    const nextMinute = deterministicSampleDecision({
      module: 'router',
      msgTemplate: 'skip best effort record',
      sampleRate: 0.5,
      timestampMs: timestamp + 61_000,
    });

    expect(minuteBucket(timestamp + 61_000)).not.toBe(minuteBucket(timestamp));
    expect(typeof current).toBe('boolean');
    expect(typeof nextMinute).toBe('boolean');
  });

  it('respects clamped sample rates', () => {
    expect(
      deterministicSampleDecision({
        module: 'm',
        msgTemplate: 'x',
        sampleRate: -5,
        timestampMs: 0,
      }),
    ).toBe(false);

    expect(
      deterministicSampleDecision({
        module: 'm',
        msgTemplate: 'x',
        sampleRate: 9,
        timestampMs: 0,
      }),
    ).toBe(true);
  });
});
