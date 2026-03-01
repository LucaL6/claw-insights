import { describe, expect, it, vi } from 'vitest';

// Mock @resvg/resvg-js to avoid native binding panics in vitest workers (ISS-046).
// The actual Resvg call is a thin SVG→PNG wrapper — our test value is in satori markup generation.
// NOTE: vi.hoisted() is required because vi.mock is hoisted to file top — plain const would be undefined.
const FAKE_PNG = vi.hoisted(() => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));
vi.mock('@resvg/resvg-js', () => ({
  Resvg: class {
    constructor(
      public svg: string,
      public opts: unknown,
    ) {}
    render() {
      return { asPng: () => new Uint8Array(FAKE_PNG) };
    }
  },
}));

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
    totalMessages: 42,
  },
  companionDays: 15,
  hostname: 'test-host',
  totalConversations: 50,
  tokensByModel: [{ model: 'claude-opus-4', modelDisplay: 'opus-4', tokensK: 128.4, percent: 100 }],
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
      turnCount: 4,
      subAgentCount: 0,
    },
  ],
  recentErrors: [{ timestamp: '14:32', type: 'error', module: 'gateway', message: 'WebSocket timeout' }],
};

describe('renderSnapshot', () => {
  it('compact/dark → valid PNG', async () => {
    const buf = await renderSnapshot(mockData, { detail: 'compact', theme: 'dark', lang: 'en' });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThanOrEqual(8);
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('standard/dark → valid PNG', async () => {
    const standard = await renderSnapshot(mockData, { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(standard.subarray(0, 8)).toEqual(PNG_HEADER);
    expect(standard.length).toBeGreaterThanOrEqual(8);
  });

  it('full/dark → valid PNG', async () => {
    const buf = await renderSnapshot(mockData, { detail: 'full', theme: 'dark', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
    expect(buf.length).toBeGreaterThanOrEqual(8);
  });

  it('light theme → valid PNG', async () => {
    const buf = await renderSnapshot(mockData, { detail: 'standard', theme: 'light', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('handles zero sessions', async () => {
    const empty = { ...mockData, sessions: [], summary: { ...mockData.summary!, activeSessions: 0, totalSessions: 0 } };
    const buf = await renderSnapshot(empty, { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('handles zero errors', async () => {
    const noErrors = { ...mockData, recentErrors: [], summary: { ...mockData.summary!, errors: 0 } };
    const buf = await renderSnapshot(noErrors, { detail: 'full', theme: 'dark', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('handles long session names without crash', async () => {
    const longName = { ...mockData, sessions: [{ ...mockData.sessions![0], name: 'a'.repeat(200) }] };
    const buf = await renderSnapshot(longName, { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(buf.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  it('handles extreme token values', async () => {
    const extreme = { ...mockData, summary: { ...mockData.summary!, tokens: 999_999_999, tokensDisplay: '999.9M' } };
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
