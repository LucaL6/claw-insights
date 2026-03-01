import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { buildMarkup } from '../index.js';

function nullData(): SnapshotData {
  return {
    gateway: null,
    channels: null,
    timestamp: new Date().toISOString(),
    range: '24h',
    time: '12:00',
    summary: null,
    tokensByModel: null,
    companionDays: null,
    hostname: 'test',
    totalConversations: null,
    _meta: { degradedSources: ['gateway'] },
  };
}

function fullData(): SnapshotData {
  return {
    gateway: { status: 'up', version: '1.0.0', uptime: '1h', cpu: 10, memoryMB: 256 },
    channels: [{ name: 'Discord', provider: 'discord', connected: true, latencyMs: 12 }],
    timestamp: new Date().toISOString(),
    range: '24h',
    time: '12:00',
    summary: {
      activeSessions: 1,
      totalSessions: 2,
      tokens: 1000,
      tokensDisplay: '1.0k',
      errors: 0,
      warnings: 0,
      uptimePercent: 100,
      totalMessages: 50,
    },
    tokensByModel: [{ model: 'claude', modelDisplay: 'Claude', tokensK: 1, percent: 100 }],
    companionDays: 30,
    hostname: 'test',
    totalConversations: 100,
  };
}

describe('null-safe rendering', () => {
  it('renders with all null data', () => {
    const node = buildMarkup(nullData(), { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(node).toBeDefined();
    expect(node.type).toBe('div');
  });

  it('null gateway shows Unknown status', () => {
    const node = buildMarkup(nullData(), { detail: 'standard', theme: 'dark', lang: 'en' });
    const json = JSON.stringify(node);
    expect(json).toContain('Unknown');
  });

  it('null tokens skips token section', () => {
    const data = nullData();
    const node = buildMarkup(data, { detail: 'standard', theme: 'dark', lang: 'en' });
    const json = JSON.stringify(node);
    // Token section title should not appear
    expect(json).not.toContain('TOKEN');
  });

  it('full data renders all sections', () => {
    const node = buildMarkup(fullData(), { detail: 'standard', theme: 'dark', lang: 'en' });
    const json = JSON.stringify(node);
    expect(json).toContain('OpenClaw');
    expect(json).toContain('Online');
  });

  it('compact with null data renders', () => {
    const node = buildMarkup(nullData(), { detail: 'compact', theme: 'dark', lang: 'en' });
    expect(node).toBeDefined();
  });
});
