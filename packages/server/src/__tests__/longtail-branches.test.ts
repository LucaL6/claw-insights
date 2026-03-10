/**
 * Long-tail branch coverage tests.
 * Covers miscellaneous uncovered branches across many files.
 */
import { describe, expect, it } from 'vitest';

// ── sampling.ts: timestampMs ?? Date.now() fallback ──
describe('sampling: missing timestampMs', () => {
  it('uses Date.now() when timestampMs is undefined', async () => {
    const { deterministicSampleDecision } = await import('../logging/sampling.js');
    // Call without timestampMs — exercises the ?? Date.now() branch (line 35)
    const result = deterministicSampleDecision({ module: 'test', msgTemplate: 'hello', sampleRate: 0.5 });
    expect(typeof result).toBe('boolean');
  });
});

// ── deadline.ts: timer !== undefined guard ──
describe('deadline: withDeadline', () => {
  it('clears timer after promise resolves', async () => {
    const { Deadline, withDeadline } = await import('../utils/deadline.js');
    const d = new Deadline(5000);
    const result = await withDeadline(Promise.resolve(42), d, Error);
    expect(result).toBe(42);
  });

  it('throws when deadline already expired', async () => {
    const { Deadline, withDeadline } = await import('../utils/deadline.js');
    const d = new Deadline(0);
    // Small delay to ensure expired
    await new Promise((r) => setTimeout(r, 5));
    await expect(withDeadline(Promise.resolve(42), d, Error)).rejects.toThrow();
  });
});

// ── pipeline.ts: replacePort with unknown key ──
describe('pipeline: replacePort unknown key', () => {
  it('throws when port key not found', async () => {
    const { Pipeline } = await import('../pipeline/pipeline.js');
    const p = new Pipeline();
    // Don't call build() — replacePort requires init state
    await expect(p.replacePort('nonexistent', { destroy: () => {} } as any)).rejects.toThrow(/not found/);
  });
});
