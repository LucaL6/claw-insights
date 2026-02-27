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
    for (const child of children) {
      results.push(...collectText(child));
    }
  }
  return results;
}

function makeData(overrides?: Partial<SnapshotData>): SnapshotData {
  return {
    gateway: { status: 'up', version: '0.1.0', uptime: '2h', cpu: 5, memoryMB: 512 },
    channels: [],
    timestamp: '2026-02-26T00:00:00Z',
    range: '6h',
    time: '23:11',
    summary: {
      activeSessions: 2,
      totalSessions: 5,
      tokens: 1000,
      tokensDisplay: '1.0k',
      errors: 0,
      warnings: 0,
      uptimePercent: 100,
    },
    companionDays: 42,
    hostname: 'mini',
    totalConversations: 128,
    ...overrides,
  } as SnapshotData;
}

describe('renderHeader', () => {
  const c = DARK;

  it('renders OpenClaw brand name', () => {
    const tree = renderHeader(makeData(), 'standard', c);
    const texts = collectText(tree);
    expect(texts).toContain('OpenClaw');
    expect(texts.join(' ')).not.toContain('Claw Insights');
  });

  it('shows Online when gateway is up', () => {
    const tree = renderHeader(makeData(), 'standard', c);
    const texts = collectText(tree);
    expect(texts).toContain('Online');
  });

  it('shows Offline when gateway is down', () => {
    const tree = renderHeader(
      makeData({ gateway: { status: 'down', version: '0.1.0', uptime: '0', cpu: 0, memoryMB: 0 } }),
      'standard',
      c,
    );
    const texts = collectText(tree);
    expect(texts).toContain('Offline');
  });

  it('shows range in subtitle', () => {
    const tree = renderHeader(makeData(), 'standard', c);
    const texts = collectText(tree);
    expect(texts.join(' ')).toContain('Past 6h Stats');
  });
});
