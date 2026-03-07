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
    channels: [
      { name: 'discord', provider: 'discord', connected: true, latencyMs: 50 },
      { name: 'telegram', provider: 'telegram', connected: false, latencyMs: null },
    ],
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

describe('renderStatusStrip branches', () => {
  it('shows CPU -- when cpu is NaN/Infinity', () => {
    const data = makeData({
      gateway: { status: 'up', version: '0.9.0', uptime: '2h', cpu: NaN, memoryMB: NaN },
    } as any);
    const tree = renderStatusStrip(data, 'standard', DARK)!;
    const texts = collectText(tree);
    expect(texts.join(' ')).toContain('CPU --');
    expect(texts.join(' ')).toContain('MEM --');
  });

  it('sorts connected channels before disconnected, then alphabetically', () => {
    const data = makeData({
      channels: [
        { name: 'zzz', provider: 'x', connected: false, latencyMs: null },
        { name: 'aaa', provider: 'x', connected: false, latencyMs: null },
        { name: 'bbb', provider: 'x', connected: true, latencyMs: 10 },
      ],
    } as any);
    const tree = renderStatusStrip(data, 'standard', DARK)!;
    const texts = collectText(tree);
    // bbb (connected) should appear before aaa and zzz (disconnected, alphabetical)
    const bbbIdx = texts.indexOf('bbb');
    const aaaIdx = texts.indexOf('aaa');
    const zzzIdx = texts.indexOf('zzz');
    expect(bbbIdx).toBeLessThan(aaaIdx);
    expect(aaaIdx).toBeLessThan(zzzIdx);
  });

  it('renders with full detail', () => {
    const tree = renderStatusStrip(makeData(), 'full', DARK)!;
    expect(tree).not.toBeNull();
    const texts = collectText(tree);
    expect(texts).toContain('messages');
  });

  it('handles empty channels array', () => {
    const data = makeData({ channels: [] } as any);
    const tree = renderStatusStrip(data, 'standard', DARK)!;
    expect(tree).not.toBeNull();
  });

  it('handles undefined channels', () => {
    const data = makeData({ channels: undefined } as any);
    const tree = renderStatusStrip(data, 'standard', DARK)!;
    expect(tree).not.toBeNull();
  });

  it('sorts channels with undefined names (name ?? "" fallback)', () => {
    const data = makeData({
      channels: [
        { name: undefined, provider: 'x', connected: true, latencyMs: 10 },
        { name: 'aaa', provider: 'x', connected: true, latencyMs: 10 },
      ],
    } as any);
    const tree = renderStatusStrip(data, 'standard', DARK)!;
    expect(tree).not.toBeNull();
  });
});
