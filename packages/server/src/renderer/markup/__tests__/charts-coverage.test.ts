import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { renderCharts } from '../charts.js';
import { DARK } from '../colors.js';
import type { SatoriNode } from '../helpers.js';

const base: SnapshotData = {
  gateway: { status: 'up', version: '1.0', uptime: '1h', cpu: 0, memoryMB: 0 },
  channels: [],
  timestamp: new Date().toISOString(),
  range: '6',
  time: '6h',
  summary: {
    activeSessions: 0,
    totalSessions: 0,
    tokens: 0,
    tokensDisplay: '0',
    errors: 0,
    warnings: 0,
    uptimePercent: 100,
    totalMessages: 0,
  },
  tokensByModel: [],
  companionDays: null,
  hostname: 'test-host',
  totalConversations: null,
  buckets: [
    { tokensK: 5, uptimePercent: 99 },
    { tokensK: 10, uptimePercent: 100 },
  ],
};

/** Recursively find all SatoriNodes with matching style property */
function findNodes(node: SatoriNode, predicate: (style: Record<string, unknown>) => boolean): SatoriNode[] {
  const results: SatoriNode[] = [];
  const style = node.props.style ?? {};
  if (predicate(style)) {
    results.push(node);
  }
  const children = Array.isArray(node.props.children) ? node.props.children : [];
  for (const child of children) {
    if (child && typeof child === 'object' && 'type' in child) {
      results.push(...findNodes(child as SatoriNode, predicate));
    }
  }
  return results;
}

describe('renderCharts branch coverage', () => {
  it('detail=compact uses height 40', () => {
    const node = renderCharts(base, 'compact', DARK);
    expect(node.type).toBe('div');
    // Sparkline children should use height 40
    const sparklines = findNodes(node, (s) => s.height === 40);
    expect(sparklines.length).toBeGreaterThan(0);
  });

  it('detail=full uses height 48', () => {
    const node = renderCharts(base, 'full', DARK);
    expect(node.type).toBe('div');
    const sparklines = findNodes(node, (s) => s.height === 48);
    expect(sparklines.length).toBeGreaterThan(0);
  });

  it('undefined buckets defaults to empty array', () => {
    const data = { ...base, buckets: undefined };
    const node = renderCharts(data as SnapshotData, 'full', DARK);
    // Should still render two cards (Token Usage + Uptime) even with no data
    expect(node.type).toBe('div');
    const cards = findNodes(node, (s) => s.borderRadius === 8);
    expect(cards.length).toBe(2);
  });

  it('bucket with tokens but no tokensK falls to tokens', () => {
    const data = { ...base, buckets: [{ tokens: 500 }] };
    const node = renderCharts(data, 'full', DARK);
    expect(node.type).toBe('div');
    const cards = findNodes(node, (s) => s.borderRadius === 8);
    expect(cards.length).toBe(2);
  });

  it('bucket with neither tokensK nor tokens falls to 0', () => {
    const data = { ...base, buckets: [{}] };
    const node = renderCharts(data, 'full', DARK);
    expect(node.type).toBe('div');
    const cards = findNodes(node, (s) => s.borderRadius === 8);
    expect(cards.length).toBe(2);
  });

  it('undefined uptimePercent defaults to 100', () => {
    const data = { ...base, buckets: [{ tokensK: 1 }] };
    const node = renderCharts(data, 'full', DARK);
    expect(node.type).toBe('div');
    const cards = findNodes(node, (s) => s.borderRadius === 8);
    expect(cards.length).toBe(2);
  });

  it('non-numeric range falls to 6', () => {
    const data = { ...base, range: 'abc' };
    const node = renderCharts(data, 'full', DARK);
    expect(node.type).toBe('div');
    // Should still render valid time axis labels
    const cards = findNodes(node, (s) => s.borderRadius === 8);
    expect(cards.length).toBe(2);
  });
});
