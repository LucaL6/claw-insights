import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import type { SatoriNode } from '../helpers.js';
import { renderTokenUsage } from '../token-usage.js';

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
    tokensByModel: [
      { model: 'gpt-4o', modelDisplay: 'GPT-4o', tokensK: 6.2, percent: 50 },
      { model: 'claude', modelDisplay: 'Claude', tokensK: 3.7, percent: 30 },
      { model: 'gemini', modelDisplay: 'Gemini', tokensK: 2.4, percent: 20 },
    ],
    tokensTrend: '+8%',
  } as SnapshotData;
}

describe('renderTokenUsage', () => {
  it('renders tokens header, trend, stacked segments, and legend rows', () => {
    const tree = renderTokenUsage(makeData(), 'standard', DARK);
    const texts = collectText(tree);
    const json = JSON.stringify(tree);

    expect(texts).toContain('TOKENS');
    expect(texts).toContain('12.3k');
    expect(texts).toContain('+8%');
    expect(texts).toContain('GPT-4o 6.2k (50%)');
    expect(texts).toContain('Claude 3.7k (30%)');
    expect(json).toContain(DARK.modelColors[0]);
    expect(json).toContain(DARK.modelColors[1]);
  });

  it('handles missing trend and empty model list', () => {
    const data = makeData();
    data.tokensByModel = [];
    data.tokensTrend = undefined;

    const tree = renderTokenUsage(data, 'compact', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('TOKENS');
    expect(texts).toContain('12.3k');
    expect(texts).not.toContain('undefined');
  });
});
