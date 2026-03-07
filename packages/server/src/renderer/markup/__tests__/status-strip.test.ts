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
    for (const child of children) {
      results.push(...collectText(child));
    }
  }
  return results;
}

function makeData(overrides?: Partial<SnapshotData>): SnapshotData {
  return {
    gateway: { status: 'up', version: '0.1.0', uptime: '2h', cpu: 12, memoryMB: 256 },
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

describe('renderStatusStrip', () => {
  const c = DARK;

  it('returns null for compact detail', () => {
    expect(renderStatusStrip(makeData(), 'compact', c)).toBeNull();
  });

  it('renders channel names', () => {
    const tree = renderStatusStrip(makeData(), 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('discord');
    expect(texts).toContain('telegram');
  });

  it('renders total messages', () => {
    const tree = renderStatusStrip(makeData(), 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('256');
    expect(texts).toContain('messages');
  });

  it('renders metrics values', () => {
    const tree = renderStatusStrip(makeData(), 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('3'); // activeSessions
    expect(texts).toContain('sessions');
    expect(texts).toContain('99%'); // uptime
    expect(texts).toContain('uptime');
    expect(texts).toContain('2'); // errors
    expect(texts).toContain('errors');
  });

  it('renders Chinese labels when locale is zh', () => {
    const tree = renderStatusStrip(makeData(), 'standard', c, 'zh')!;
    const texts = collectText(tree);
    expect(texts).toContain('消息');
    expect(texts).toContain('会话');
    expect(texts).toContain('在线率');
    expect(texts).toContain('错误');
  });

  it('renders CPU and MEM', () => {
    const tree = renderStatusStrip(makeData(), 'standard', c)!;
    const texts = collectText(tree);
    expect(texts.join(' ')).toContain('CPU 12%');
    expect(texts.join(' ')).toContain('MEM 256 MB');
  });
});
