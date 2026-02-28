import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import { renderErrors } from '../errors.js';
import type { SatoriNode } from '../helpers.js';

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

describe('renderErrors branches', () => {
  it('truncates long messages to ~60 chars with ellipsis', () => {
    const longMsg = 'A'.repeat(100);
    const data = {
      recentErrors: [{ timestamp: '2026-01-01T12:00:00Z', type: 'error', module: 'x', message: longMsg }],
    } as unknown as SnapshotData;
    const tree = renderErrors(data, DARK)!;
    const texts = collectText(tree);
    const truncated = texts.find((t) => t.includes('...'));
    expect(truncated).toBeDefined();
    expect(truncated!.length).toBe(63); // 60 + '...'
  });

  it('does not truncate short messages', () => {
    const shortMsg = 'Short error';
    const data = {
      recentErrors: [{ timestamp: '2026-01-01T12:00:00Z', type: 'error', module: 'x', message: shortMsg }],
    } as unknown as SnapshotData;
    const tree = renderErrors(data, DARK)!;
    const texts = collectText(tree);
    expect(texts).toContain('Short error');
  });

  it('displays at most 5 errors', () => {
    const errors = Array.from({ length: 8 }, (_, i) => ({
      timestamp: '2026-01-01T12:00:00Z',
      type: 'error',
      module: 'x',
      message: `error ${i}`,
    }));
    const data = { recentErrors: errors } as unknown as SnapshotData;
    const tree = renderErrors(data, DARK)!;
    const texts = collectText(tree);
    const errorTexts = texts.filter((t) => t.startsWith('error '));
    expect(errorTexts.length).toBe(5);
  });

  it('handles error type fallback to "error" when type is empty', () => {
    const data = {
      recentErrors: [{ timestamp: '2026-01-01T12:00:00Z', type: '', module: 'x', message: 'test' }],
    } as unknown as SnapshotData;
    const tree = renderErrors(data, DARK)!;
    const texts = collectText(tree);
    expect(texts).toContain('ERROR');
  });
});
