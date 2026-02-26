import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../services/snapshot-types.js';
import { renderSnapshot, renderSnapshotSvg } from '../satori-renderer.js';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const mockData: SnapshotData = {
  gateway: { status: 'up', version: 'v1.0.0', uptime: '1d 2h', cpu: 3.2, memoryMB: 187 },
  channels: [{ name: 'telegram', provider: 'telegram', connected: true, latencyMs: 45 }],
  timestamp: '2026-02-23T00:00:00Z',
  range: '24h',
  time: '2026-02-23 00:00',
  summary: {
    activeSessions: 2,
    totalSessions: 4,
    tokens: 128400,
    tokensDisplay: '128.4k',
    errors: 1,
    warnings: 0,
    uptimePercent: 99.8,
  },
  sparklines: {
    sessions: Array(24).fill(2),
    tokens: Array(24).fill(100),
    errors: Array(24).fill(0),
    uptime: Array(24).fill('up') as ('up' | 'degraded' | 'down')[],
  },
  sessions: [
    {
      name: 'main',
      status: 'active',
      model: 'claude-opus-4',
      modelDisplay: 'opus-4',
      channel: 'telegram',
      totalTokens: 42100,
      totalTokensDisplay: '42.1k',
      usagePercent: 68,
      updatedAt: '2m ago',
      subAgentCount: 0,
    },
  ],
  recentErrors: [{ timestamp: '14:32', type: 'error', module: 'gateway', message: 'WebSocket timeout' }],
};

describe('renderSnapshot', () => {
  it('compact/dark → valid PNG', async () => {
    const buf = await renderSnapshot(mockData, { detail: 'compact', theme: 'dark', lang: 'en' });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(5000);
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('standard/dark → valid PNG', async () => {
    const standard = await renderSnapshot(mockData, { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(standard.subarray(0, 8)).toEqual(PNG_HEADER);
    expect(standard.length).toBeGreaterThan(5000);
  });

  it('full/dark → valid PNG', async () => {
    const buf = await renderSnapshot(mockData, { detail: 'full', theme: 'dark', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
    expect(buf.length).toBeGreaterThan(10000);
  });

  it('light theme → valid PNG', async () => {
    const buf = await renderSnapshot(mockData, { detail: 'standard', theme: 'light', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('handles zero sessions', async () => {
    const empty = { ...mockData, sessions: [], summary: { ...mockData.summary, activeSessions: 0, totalSessions: 0 } };
    const buf = await renderSnapshot(empty, { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('handles zero errors', async () => {
    const noErrors = { ...mockData, recentErrors: [], summary: { ...mockData.summary, errors: 0 } };
    const buf = await renderSnapshot(noErrors, { detail: 'full', theme: 'dark', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('handles long session names without crash', async () => {
    const longName = { ...mockData, sessions: [{ ...mockData.sessions[0], name: 'a'.repeat(200) }] };
    const buf = await renderSnapshot(longName, { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('handles extreme token values', async () => {
    const extreme = { ...mockData, summary: { ...mockData.summary, tokens: 999_999_999, tokensDisplay: '999.9M' } };
    const buf = await renderSnapshot(extreme, { detail: 'compact', theme: 'dark', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('handles Chinese lang option', async () => {
    const buf = await renderSnapshot(mockData, { detail: 'standard', theme: 'dark', lang: 'zh' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });
});

describe('renderSnapshotSvg', () => {
  it('returns valid SVG string (compact/dark)', async () => {
    const svg = await renderSnapshotSvg(mockData, { detail: 'compact', theme: 'dark', lang: 'en' });
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('returns valid SVG string (standard/dark)', async () => {
    const svg = await renderSnapshotSvg(mockData, { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(svg).toContain('<svg');
  });

  it('returns valid SVG string (full/dark)', async () => {
    const svg = await renderSnapshotSvg(mockData, { detail: 'full', theme: 'dark', lang: 'en' });
    expect(svg).toContain('<svg');
  });

  it('returns valid SVG for light theme', async () => {
    const svg = await renderSnapshotSvg(mockData, { detail: 'standard', theme: 'light', lang: 'en' });
    expect(svg).toContain('<svg');
  });

  it('SVG does not go through Resvg (returns string, not Buffer)', async () => {
    const svg = await renderSnapshotSvg(mockData, { detail: 'compact', theme: 'dark', lang: 'en' });
    expect(svg).not.toBeInstanceOf(Buffer);
    expect(typeof svg).toBe('string');
  });
});
