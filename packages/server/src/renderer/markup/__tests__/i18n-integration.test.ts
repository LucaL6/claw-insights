import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { buildMarkup } from '../index.js';

function collectAllText(node: unknown): string[] {
  if (typeof node === 'string') {
    return [node];
  }
  if (typeof node === 'number') {
    return [String(node)];
  }
  if (!node || typeof node !== 'object') {
    return [];
  }
  const n = node as { props?: { children?: unknown } };
  const results: string[] = [];
  const children = n.props?.children;
  if (typeof children === 'string') {
    results.push(children);
  } else if (Array.isArray(children)) {
    for (const child of children) {
      results.push(...collectAllText(child));
    }
  }
  return results;
}

const testData: SnapshotData = {
  gateway: { status: 'up', version: '1.0.0', uptime: '2d', cpu: 5, memoryMB: 100 },
  channels: [{ name: 'telegram', provider: 'telegram', connected: true, latencyMs: 50 }],
  timestamp: '2026-02-23T12:00:00Z',
  range: '6h',
  time: '12:00',
  summary: {
    activeSessions: 2,
    totalSessions: 3,
    tokens: 12000,
    tokensDisplay: '12k',
    errors: 2,
    warnings: 1,
    uptimePercent: 99.5,
    totalMessages: 100,
  },
  sessions: [
    {
      name: 'main',
      status: 'active',
      model: 'claude-3',
      modelDisplay: 'Claude 3',
      channel: 'telegram',
      totalTokens: 8000,
      totalTokensDisplay: '8k',
      usagePercent: 60,
      updatedAt: '2m ago',
      subAgentCount: 1,
      turnCount: 5,
    },
  ],
  recentErrors: [{ timestamp: '2026-02-23T11:00:00Z', type: 'error', module: 'gateway', message: 'connection lost' }],
  tokensByModel: [{ model: 'claude-3', modelDisplay: 'Claude 3', tokensK: 12, percent: 100 }],
  companionDays: 30,
  hostname: 'mini',
  totalConversations: 100,
} as unknown as SnapshotData;

describe('i18n integration', () => {
  it('English snapshot uses English labels', () => {
    const tree = buildMarkup(testData, { detail: 'standard', theme: 'dark', lang: 'en' });
    const texts = collectAllText(tree);
    const joined = texts.join(' ');
    expect(joined).toContain('Last 6 Hours');
    expect(joined).toContain('Online');
    expect(joined).toContain('SESSIONS');
    expect(joined).toContain('TOKEN USED');
    expect(joined).not.toContain('Past 6h Stats');
  });

  it('Chinese snapshot uses Chinese labels', () => {
    const tree = buildMarkup(testData, { detail: 'standard', theme: 'dark', lang: 'zh' });
    const texts = collectAllText(tree);
    const joined = texts.join(' ');
    expect(joined).toContain('最近 6 小时');
    expect(joined).toContain('在线');
    expect(joined).toContain('会话');
    expect(joined).toContain('TOKEN 用量');
  });

  it('compact detail still uses i18n for header', () => {
    const tree = buildMarkup(testData, { detail: 'compact', theme: 'dark', lang: 'zh' });
    const texts = collectAllText(tree);
    const joined = texts.join(' ');
    expect(joined).toContain('在线');
    expect(joined).toContain('最近 6 小时');
  });

  it('light theme with Chinese locale works', () => {
    const tree = buildMarkup(testData, { detail: 'standard', theme: 'light', lang: 'zh' });
    const texts = collectAllText(tree);
    const joined = texts.join(' ');
    expect(joined).toContain('在线');
  });
});
