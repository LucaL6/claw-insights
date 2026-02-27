import { afterEach, describe, expect, it, vi } from 'vitest';

import { CollectTimeoutError, PayloadTooLargeError, RateLimitedError } from '../../utils/snapshot-errors.js';
import { SnapshotEngine } from '../snapshot-engine.js';
import type { DataSources, SnapshotRequest } from '../snapshot-types.js';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../renderer/satori-renderer.js', () => ({
  renderSnapshot: vi.fn().mockResolvedValue(Buffer.alloc(100)),
  renderSnapshotSvg: vi.fn().mockResolvedValue('<svg></svg>'),
}));

vi.mock('../snapshot-service.js', () => ({
  buildSnapshotData: vi.fn().mockResolvedValue({
    gateway: { status: 'up', version: '1.0.0', uptime: '1h', cpu: 0, memoryMB: 0 },
    channels: [],
    timestamp: new Date().toISOString(),
    range: '6h',
    time: '12:00',
    summary: {
      activeSessions: 0,
      totalSessions: 0,
      tokens: 0,
      tokensDisplay: '0',
      errors: 0,
      warnings: 0,
      uptimePercent: 100,
    },
    tokensByModel: [],
  }),
}));

vi.mock('../../logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockSources: DataSources = {
  getGateway: vi.fn().mockResolvedValue({ running: true, version: '1.0', uptime: '1h' }),
  getChannels: vi.fn().mockResolvedValue([]),
  getSessions: vi.fn().mockReturnValue([]),
  getMetrics: vi
    .fn()
    .mockReturnValue({ totalTokensK: 0, totalErrors: 0, totalWarnings: 0, uptimePercent: 100, buckets: [] }),
  getRecentErrors: vi.fn().mockReturnValue([]),
  getModelTokenUsage: vi.fn().mockReturnValue([]),
  getTokenTrend: vi.fn().mockReturnValue(null),
  getTurnCounts: vi.fn().mockReturnValue({ total: 0, bySession: [] }),
};

const defaultParams: SnapshotRequest = {
  layout: 'desktop',
  detail: 'standard',
  format: 'png',
  range: '6h',
  theme: 'dark',
  lang: 'en',
  section: 'dashboard',
};

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────

describe('SnapshotEngine', () => {
  it('returns PNG buffer on success', async () => {
    const engine = new SnapshotEngine(mockSources);
    const result = await engine.execute(defaultParams);
    expect(result.format).toBe('png');
    expect(result.output).toBeInstanceOf(Buffer);
    expect(result.contentType).toBe('image/png');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.degraded).toBe(false);
  });

  it('returns SVG string on success', async () => {
    const engine = new SnapshotEngine(mockSources);
    const result = await engine.execute({ ...defaultParams, format: 'svg' });
    expect(result.format).toBe('svg');
    expect(typeof result.output).toBe('string');
    expect(result.contentType).toBe('image/svg+xml');
  });

  it('returns JSON data (no render pool)', async () => {
    const engine = new SnapshotEngine(mockSources);
    const result = await engine.execute({ ...defaultParams, format: 'json' });
    expect(result.format).toBe('json');
    expect(result.contentType).toBe('application/json');
    expect(typeof result.output).toBe('object');
  });

  it('throws RateLimitedError when limit exceeded', async () => {
    const engine = new SnapshotEngine(mockSources);
    // Exhaust rate limit (30 req/min)
    for (let i = 0; i < 30; i++) {
      await engine.execute({ ...defaultParams, format: 'json' }); // json is fastest
    }
    await expect(engine.execute(defaultParams)).rejects.toThrow(RateLimitedError);
  });

  it('auto-degrades detail when output exceeds 2MB', async () => {
    const { renderSnapshot } = await import('../../renderer/satori-renderer.js');
    (renderSnapshot as any)
      .mockResolvedValueOnce(Buffer.alloc(3 * 1024 * 1024)) // full: too big
      .mockResolvedValueOnce(Buffer.alloc(3 * 1024 * 1024)) // standard: too big
      .mockResolvedValueOnce(Buffer.alloc(100_000)); // compact: ok

    const engine = new SnapshotEngine(mockSources);
    const result = await engine.execute({ ...defaultParams, detail: 'full' });
    expect(result.detail).toBe('compact');
    expect(result.degraded).toBe(true);
  });

  it('throws PayloadTooLargeError when all detail levels exceed 2MB', async () => {
    const { renderSnapshot } = await import('../../renderer/satori-renderer.js');
    (renderSnapshot as any).mockResolvedValue(Buffer.alloc(3 * 1024 * 1024));

    const engine = new SnapshotEngine(mockSources);
    await expect(engine.execute({ ...defaultParams, detail: 'full' })).rejects.toThrow(PayloadTooLargeError);
  });

  it('throws CollectTimeoutError when data collection is slow', async () => {
    const { buildSnapshotData } = await import('../snapshot-service.js');
    (buildSnapshotData as any).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 20_000)));

    const engine = new SnapshotEngine(mockSources);
    await expect(engine.execute({ ...defaultParams, format: 'json' })).rejects.toThrow(CollectTimeoutError);
  }, 20_000);

  it('exposes stats getter', () => {
    const engine = new SnapshotEngine(mockSources);
    const stats = engine.stats;
    expect(stats).toHaveProperty('renderConcurrency');
    expect(stats).toHaveProperty('renderQueueLength');
    expect(stats.renderConcurrency).toBe(0);
    expect(stats.renderQueueLength).toBe(0);
  });
});
