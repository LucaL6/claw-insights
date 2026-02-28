import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import type { SatoriNode } from '../helpers.js';
import { renderTokenUsage } from '../token-usage.js';

function collectText(node: SatoriNode | string | unknown): string[] {
  if (typeof node === 'string') {return [node];}
  if (typeof node === 'number') {return [String(node)];}
  if (!node || typeof node !== 'object') {return [];}
  const n = node as SatoriNode;
  const results: string[] = [];
  const children = n.props?.children;
  if (typeof children === 'string') {results.push(children);}
  else if (Array.isArray(children)) {for (const c of children) {results.push(...collectText(c));}}
  return results;
}

describe('renderTokenUsage branches', () => {
  it('formats large tokens as M (>= 1000k)', () => {
    const data = {
      summary: { tokensDisplay: '1500k' },
      tokensByModel: [{ model: 'claude', modelDisplay: 'Claude', tokensK: 1500, percent: 100 }],
    } as unknown as SnapshotData;
    const tree = renderTokenUsage(data, 'standard', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('1.50M');
  });

  it('formats small tokens as k (< 1000k)', () => {
    const data = {
      summary: { tokensDisplay: '42k' },
      tokensByModel: [{ model: 'claude', modelDisplay: 'Claude', tokensK: 42, percent: 100 }],
    } as unknown as SnapshotData;
    const tree = renderTokenUsage(data, 'standard', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('42.0k');
  });

  it('handles tokensDisplay without unit', () => {
    const data = {
      summary: { tokensDisplay: '123' },
      tokensByModel: [],
    } as unknown as SnapshotData;
    const tree = renderTokenUsage(data, 'standard', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('123');
  });

  it('handles tokensDisplay with no regex match', () => {
    const data = {
      summary: { tokensDisplay: '---' },
      tokensByModel: [],
    } as unknown as SnapshotData;
    const tree = renderTokenUsage(data, 'standard', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('---');
  });

  it('handles undefined tokensByModel', () => {
    const data = {
      summary: { tokensDisplay: '5k' },
      tokensByModel: undefined,
    } as unknown as SnapshotData;
    const tree = renderTokenUsage(data, 'standard', DARK);
    expect(tree).toBeDefined();
  });
});
