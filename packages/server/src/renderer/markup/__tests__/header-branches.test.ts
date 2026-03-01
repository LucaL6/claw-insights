import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import { renderHeader } from '../header.js';
import type { SatoriNode } from '../helpers.js';

function collectText(node: SatoriNode | string | unknown): string[] {
  if (typeof node === 'string') {
    return [node];
  }
  if (typeof node === 'number') {
    return [String(node)];
  }
  if (!node || typeof node !== 'object') {
    return [];
  }
  const n = node as SatoriNode;
  const results: string[] = [];
  const children = n.props?.children;
  if (typeof children === 'string') {
    results.push(children);
  } else if (Array.isArray(children)) {
    for (const c of children) {
      results.push(...collectText(c));
    }
  }
  return results;
}

describe('renderHeader branches', () => {
  it('shows Offline when gateway status is not up', () => {
    const data = {
      gateway: { status: 'down' },
      range: '6h',
    } as unknown as SnapshotData;
    const tree = renderHeader(data, 'standard', DARK, 'en');
    const texts = collectText(tree);
    expect(texts).toContain('Offline');
  });

  it('shows Online when gateway status is up', () => {
    const data = {
      gateway: { status: 'up' },
      range: '6h',
    } as unknown as SnapshotData;
    const tree = renderHeader(data, 'standard', DARK, 'en');
    const texts = collectText(tree);
    expect(texts).toContain('Online');
  });

  it('omits subtitle when range is empty', () => {
    const data = {
      gateway: { status: 'up' },
      range: '',
    } as unknown as SnapshotData;
    const tree = renderHeader(data, 'standard', DARK, 'en');
    const texts = collectText(tree);
    expect(texts.join(' ')).not.toContain('Last');
  });
});
