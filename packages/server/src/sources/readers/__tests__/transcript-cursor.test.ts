import { describe, expect, it } from 'vitest';

import { compareCursors, decodeCursor, encodeCursor } from '../transcript-cursor.js';

describe('transcript-cursor', () => {
  it('round-trips encode/decode', () => {
    const cursor = encodeCursor('2026-03-06T12:00:00.000Z', 42);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual({ ts: '2026-03-06T12:00:00.000Z', seq: 42 });
  });

  it('returns null for invalid cursor', () => {
    expect(decodeCursor('not-valid')).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('returns null for valid base64 but invalid structure', () => {
    // Valid base64 of {"ts":1,"seq":"x"} — wrong types
    const bad = Buffer.from(JSON.stringify({ ts: 1, seq: 'x' })).toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });

  it('compareCursors: different timestamps', () => {
    expect(
      compareCursors({ ts: '2026-03-06T12:00:00.000Z', seq: 0 }, { ts: '2026-03-06T13:00:00.000Z', seq: 0 }),
    ).toBeLessThan(0);
  });

  it('compareCursors: same timestamp, different seq', () => {
    expect(
      compareCursors({ ts: '2026-03-06T12:00:00.000Z', seq: 1 }, { ts: '2026-03-06T12:00:00.000Z', seq: 5 }),
    ).toBeLessThan(0);
  });

  it('compareCursors: equal', () => {
    expect(compareCursors({ ts: '2026-03-06T12:00:00.000Z', seq: 3 }, { ts: '2026-03-06T12:00:00.000Z', seq: 3 })).toBe(
      0,
    );
  });
});
