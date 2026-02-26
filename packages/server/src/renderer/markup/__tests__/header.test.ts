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
    sparklines: { sessions: [], tokens: [], errors: [], uptime: [] },
    ...overrides,
  } as SnapshotData;
}

describe('renderHeader', () => {
  const data = makeData();
  const c = DARK;

  it('renders brand name and time', () => {
    const tree = renderHeader(data, 'standard', c);
    const texts = collectText(tree);
    expect(texts).toContain('Claw Insights');
    expect(texts).toContain('23:11');
  });

  it('standard detail renders version', () => {
    const tree = renderHeader(data, 'standard', c);
    const texts = collectText(tree);
    expect(texts).toContain('v0.1.0');
  });

  it('compact detail does NOT render version', () => {
    const tree = renderHeader(data, 'compact', c);
    const texts = collectText(tree);
    expect(texts).not.toContain('v0.1.0');
    expect(texts).not.toContain('0.1.0');
  });

  it('does NOT render status badge, CPU, MEM, or range', () => {
    const tree = renderHeader(data, 'standard', c);
    const texts = collectText(tree);
    expect(texts).not.toContain('UP');
    expect(texts).not.toContain('DOWN');
    expect(texts.join(' ')).not.toMatch(/CPU/);
    expect(texts.join(' ')).not.toMatch(/MEM/);
    expect(texts).not.toContain('6h');
  });
});
