import { describe, expect, it } from 'vitest';

import { computeHierarchyParity } from '../session-reader';

describe('session-reader parity helper', () => {
  it('computes zero drift when base and final sets match', () => {
    const base = new Set(['child-a', 'child-b']);
    const final = new Set(['child-a', 'child-b']);

    expect(computeHierarchyParity(base, final)).toEqual({
      baseChildCount: 2,
      finalChildCount: 2,
      overlayOnlyCount: 0,
      missingAfterOverlayCount: 0,
    });
  });

  it('computes overlayOnlyCount for event-only attachments', () => {
    const base = new Set(['child-a']);
    const final = new Set(['child-a', 'child-b', 'child-c']);

    const parity = computeHierarchyParity(base, final);
    expect(parity.baseChildCount).toBe(1);
    expect(parity.finalChildCount).toBe(3);
    expect(parity.overlayOnlyCount).toBe(2);
    expect(parity.missingAfterOverlayCount).toBe(0);
  });

  it('computes missingAfterOverlayCount when final set drops base children', () => {
    const base = new Set(['child-a', 'child-b', 'child-c']);
    const final = new Set(['child-a']);

    const parity = computeHierarchyParity(base, final);
    expect(parity.overlayOnlyCount).toBe(0);
    expect(parity.missingAfterOverlayCount).toBe(2);
  });
});
