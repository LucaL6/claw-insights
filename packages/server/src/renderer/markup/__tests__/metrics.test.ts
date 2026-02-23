import { describe, it, expect } from 'vitest';
import { renderMetrics } from '../metrics.js';
import { DARK } from '../colors.js';
import type { SatoriNode } from '../helpers.js';
import type { SnapshotData } from '../../../services/snapshot-types.js';

/** Recursively collect all text content from a SatoriNode tree. */
function collectText(node: SatoriNode | string | unknown): string[] {
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (!node || typeof node !== 'object') return [];
  const n = node as SatoriNode;
  const results: string[] = [];
  const children = n.props?.children;
  if (typeof children === 'string') {
    results.push(children);
  } else if (Array.isArray(children)) {
    for (const child of children) {
      results.push(...collectText(child));
    }
  }
  return results;
}

function makeData(): SnapshotData {
  return {
    gateway: { status: 'up', version: '1.0.0', uptime: '2d', cpu: 5, memoryMB: 100 },
    channels: [],
    timestamp: '2026-02-23T00:00:00Z',
    range: '6h',
    time: '00:00',
    summary: {
      activeSessions: 3,
      totalSessions: 10,
      tokens: 12345,
      tokensDisplay: '12.3k',
      errors: 0,
      warnings: 0,
      uptimePercent: 99.9,
    },
    sparklines: {
      sessions: [1, 2, 3],
      tokens: [100, 200, 300],
      errors: [0, 0, 0],
      uptime: ['up', 'up', 'up'],
    },
  };
}

describe('renderMetrics', () => {
  const data = makeData();

  it('compact mode includes rangeLabel', () => {
    const tree = renderMetrics(data, 'compact', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('peak 6h');
    expect(texts).toContain('6h total');
  });

  it('standard mode includes rangeLabel', () => {
    const tree = renderMetrics(data, 'standard', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('peak 6h');
    expect(texts).toContain('6h total');
  });

  it('full mode includes rangeLabel', () => {
    const tree = renderMetrics(data, 'full', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('peak 6h');
    expect(texts).toContain('6h total');
  });
});
