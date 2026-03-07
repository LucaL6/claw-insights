import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import type { SatoriNode } from '../helpers.js';
import { renderStatusStrip } from '../status-strip.js';

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

function makeData(overrides?: Partial<SnapshotData>): SnapshotData {
  return {
    gateway: { status: 'up', version: '0.9.0', uptime: '2h', cpu: 12, memoryMB: 256 },
    channels: [{ name: 'discord', provider: 'discord', connected: true, latencyMs: 50 }],
    timestamp: '2026-02-26T12:00:00Z',
    range: '6h',
    time: '12:00',
    summary: {
      activeSessions: 3,
      totalSessions: 10,
      tokens: 5000,
      tokensDisplay: '5.0k',
      errors: 2,
      warnings: 1,
      uptimePercent: 99,
      totalMessages: 256,
    },
    companionDays: 30,
    hostname: 'mini',
    totalConversations: 256,
    ...overrides,
  } as SnapshotData;
}

describe('renderStatusStrip coverage', () => {
  it('formats memory as GB when >= 1024 MB', () => {
    const data = makeData({
      gateway: { status: 'up', version: '0.9.0', uptime: '2h', cpu: 50, memoryMB: 2048 },
    } as any);
    const tree = renderStatusStrip(data, 'standard', DARK)!;
    const texts = collectText(tree);
    const joined = texts.join(' ');
    expect(joined).toContain('2.00 GB');
  });

  it('formats memory as MB when < 1024 MB', () => {
    const data = makeData({
      gateway: { status: 'up', version: '0.9.0', uptime: '2h', cpu: 50, memoryMB: 512 },
    } as any);
    const tree = renderStatusStrip(data, 'standard', DARK)!;
    const texts = collectText(tree);
    const joined = texts.join(' ');
    expect(joined).toContain('512 MB');
  });

  it('renders with null gateway (CPU -- / MEM --)', () => {
    const data = makeData({ gateway: null } as any);
    const tree = renderStatusStrip(data, 'standard', DARK)!;
    const texts = collectText(tree);
    const joined = texts.join(' ');
    expect(joined).toContain('CPU --');
    expect(joined).toContain('MEM --');
  });

  it('renders with null summary (defaults to 0)', () => {
    const data = makeData({ summary: null } as any);
    const tree = renderStatusStrip(data, 'standard', DARK)!;
    const texts = collectText(tree);
    const joined = texts.join(' ');
    expect(joined).toContain('0');
  });

  it('returns null for compact detail level', () => {
    const tree = renderStatusStrip(makeData(), 'compact', DARK);
    expect(tree).toBeNull();
  });
});
