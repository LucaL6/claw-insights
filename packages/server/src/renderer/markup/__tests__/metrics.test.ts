import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import type { SatoriNode } from '../helpers.js';
import { renderMetrics } from '../metrics.js';

/** Recursively collect all text content from a SatoriNode tree. */
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
    for (const child of children) {
      results.push(...collectText(child));
    }
  }
  return results;
}

function makeData(errors = 0, uptimePercent = 99.9): SnapshotData {
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
      errors,
      warnings: 0,
      uptimePercent,
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
  it.each(['compact', 'standard', 'full'] as const)('renders a single-line summary for %s', (detail) => {
    const tree = renderMetrics(makeData(0), detail, DARK);
    const texts = collectText(tree);
    expect(texts).toContain('3 active sessions');
    expect(texts).toContain('99.9% uptime');
    expect(texts).not.toContain('⚠️ 0 errors');
    expect(texts.join(' ')).not.toContain('peak 6h');
    expect(texts.join(' ')).not.toContain('6h total');
  });

  it('formats uptimePercent to one decimal place', () => {
    const tree = renderMetrics(makeData(0, 99), 'compact', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('99.0% uptime');
  });

  it('shows errors item only when errors > 0', () => {
    const tree = renderMetrics(makeData(2), 'standard', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('⚠️ 2 errors');
  });
});
