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
      totalMessages: 100,
    },
    companionDays: 15,
    hostname: 'test-host',
    totalConversations: 50,
    tokensByModel: [
      { model: 'gpt-4o', modelDisplay: 'GPT-4o', tokensK: 6.2, percent: 50 },
      { model: 'claude', modelDisplay: 'Claude', tokensK: 3.7, percent: 30 },
      { model: 'gemini', modelDisplay: 'Gemini', tokensK: 2.4, percent: 20 },
    ],
    tokensTrend: '+8%',
  } as SnapshotData;
}

describe('renderTokenUsage', () => {
  it('renders token used label, big number, gradient bar, and legend', () => {
    const tree = renderTokenUsage(makeData(), 'standard', DARK);
    const texts = collectText(tree);
    const json = JSON.stringify(tree);

    // Section label
    expect(texts).toContain('TOKEN USED');

    // Big number split into number + unit
    expect(texts).toContain('12.3');
    expect(texts).toContain('K');

    // Gradient bar segments
    expect(json).toContain(DARK.modelGradients[0][0]);
    expect(json).toContain(DARK.modelGradients[1][0]);
    expect(json).toContain('linear-gradient');

    // Legend items: separate model name and tokensK
    expect(texts).toContain('GPT-4o');
    expect(texts).toContain('6.2k');
    expect(texts).toContain('Claude');
    expect(texts).toContain('3.7k');

    // Range pill styling
  });

  it('handles empty model list', () => {
    const data = makeData();
    data.tokensByModel = [];
    data.tokensTrend = undefined;

    const tree = renderTokenUsage(data, 'compact', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('TOKEN USED');
    expect(texts).toContain('12.3');
    expect(texts).not.toContain('undefined');
  });

  it('handles tokensDisplay without unit suffix', () => {
    const data = makeData();
    data.summary.tokensDisplay = '500';
    const tree = renderTokenUsage(data, 'standard', DARK);
    const texts = collectText(tree);
    expect(texts).toContain('500');
  });
});
