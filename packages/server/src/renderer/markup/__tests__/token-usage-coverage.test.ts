import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import type { SatoriNode } from '../helpers.js';
import { renderTokenUsage } from '../token-usage.js';

function collectText(node: SatoriNode | string | unknown): string[] {
  if (typeof node === 'string') { return [node]; }
  if (typeof node === 'number') { return [String(node)]; }
  if (!node || typeof node !== 'object') { return []; }
  const n = node as SatoriNode;
  const results: string[] = [];
  const children = n.props?.children;
  if (typeof children === 'string') { results.push(children); }
  else if (Array.isArray(children)) { for (const c of children) { results.push(...collectText(c)); } }
  return results;
}

describe('renderTokenUsage coverage', () => {
  it('uses model name when modelDisplay is empty', () => {
    const data = {
      summary: { tokensDisplay: '10k' },
      tokensByModel: [{ model: 'gpt-4', modelDisplay: '', tokensK: 10, percent: 100 }],
    } as unknown as SnapshotData;
    const tree = renderTokenUsage(data, 'standard', DARK);
    const texts = collectText(tree);
    // Should fall back to model name since modelDisplay is empty
    expect(texts).toContain('gpt-4');
  });

  it('uses model name when modelDisplay is undefined', () => {
    const data = {
      summary: { tokensDisplay: '10k' },
      tokensByModel: [{ model: 'claude-3', tokensK: 10, percent: 100 }],
    } as unknown as SnapshotData;
    const tree = renderTokenUsage(data, 'standard', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('claude-3');
  });
});
