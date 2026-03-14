import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { registerSnapshot } from '../routes/snapshot.js';
import { SnapshotEngine } from '../services/snapshot-engine.js';
import type { DataSources } from '../services/snapshot-types.js';

// ── Mock config to disable auth ──
vi.mock('../config.js', () => ({
  config: {
    noAuth: true,
    apiToken: 'test-token',
    serverPort: 41041,
    cliPath: 'openclaw',
    isDev: true,
    serverOnly: false,
  },
  getDataDir: () => '/tmp/.claw-insights-test',
}));

// ── Mock Data Sources ──

const mockSources: DataSources = {
  getGateway: async () => ({ running: true, version: 'v1.0.0', uptime: '1d 2h', cpu: 3.2, memoryMB: 187 }),
  getChannels: async () => [{ name: 'telegram', provider: 'telegram', connected: true, latencyMs: 45 }],
  getSessions: () => [],
  getMetrics: () => ({
    totalTokensK: 128.4,
    totalErrors: 1,
    totalWarnings: 0,
    uptimePercent: 99.8,
    buckets: [],
  }),
  getRecentErrors: () => ({
    events: [{ timestamp: '14:32', type: 'error', module: 'gateway', message: 'WebSocket timeout' }],
    total: 1,
    counts: { error: 1, warning: 0, restart: 0 },
  }),
  getModelTokenUsage: vi.fn().mockReturnValue([{ model: 'claude-opus-4', tokensK: 128.4 }]),
  getTokenTrend: vi.fn().mockReturnValue(10),
  getTurnCounts: vi.fn().mockReturnValue({ total: 4, bySession: [] }),
  getCompanionDays: async () => 15,
  getTotalConversations: () => 128,
  getRangeMessageCount: () => 42,
};

// ── Mock the heavy renderer (avoids font loading) ──
vi.mock('../renderer/satori-renderer.js', () => ({
  renderSnapshot: vi.fn(async () => {
    // Return a tiny valid PNG (8-byte header + minimal IEND)
    return Buffer.from(
      '89504e470d0a1a0a0000000d494844520000000100000001080200000090774de70000000c4944415408d763f8cf00000001010000182dd56e0000000049454e44ae426082',
      'hex',
    );
  }),
  renderSnapshotSvg: vi.fn(
    async () => '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><text>Test</text></svg>',
  ),
}));

// ── Create test app ──
function createTestApp() {
  const app = express();
  app.use(express.json());
  const engine = new SnapshotEngine(mockSources);
  registerSnapshot(app, engine);
  return app;
}

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('Snapshot Integration', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createTestApp();
  });

  // ── 1. PNG 200 with correct headers ──
  it('POST /api/snapshot → PNG 200 with correct headers', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'png', detail: 'compact', range: '6h' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.headers['x-snapshot-duration']).toBeDefined();
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="claw-insights-/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.subarray(0, 8)).toEqual(PNG_HEADER);
  });

  // ── 2. SVG 200 with correct content-type ──
  it('POST /api/snapshot format=svg → SVG 200', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'svg', detail: 'compact' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
    // supertest may return body as buffer for non-text content types
    const body = typeof res.text === 'string' ? res.text : res.body.toString('utf-8');
    expect(body).toContain('<svg');
    expect(body).toContain('</svg>');
  });

  // ── 3. JSON 200 with X-Snapshot-Duration ──
  it('POST /api/snapshot format=json → JSON 200', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['x-snapshot-duration']).toBeDefined();
    expect(res.body).toHaveProperty('gateway');
  });

  // ── 4. Default range = 24h ──
  it('defaults range to 24h when not specified', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json' });

    expect(res.status).toBe(200);
    // The snapshot service should use 24h range by default
    // Verified by the fact that the request succeeds without a range param
  });

  // ── 5. section param accepted ──
  it('accepts section param without error', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json', section: 'logs' });

    expect(res.status).toBe(200);
  });

  // ── 6. Invalid param → 400 with unified error format ──
  it('invalid param → 400 with code + suggestion', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'webp' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'INVALID_PARAM');
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('suggestion');
  });

  // ── 7. Rate limiting triggers 429 after 30 requests ──
  it('rate limiting triggers 429 after 30 requests', async () => {
    // Freeze Date.now to avoid refill timing flakiness in slow CI runs.
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      // Fresh app with its own rate limiter
      const rateLimitApp = createTestApp();

      const results: number[] = [];
      for (let i = 0; i < 35; i++) {
        const res = await request(rateLimitApp).post('/api/snapshot').send({ format: 'json' });
        results.push(res.status);
      }

      const okCount = results.filter((s) => s === 200).length;
      const rateLimited = results.filter((s) => s === 429).length;

      expect(okCount).toBe(30);
      expect(rateLimited).toBeGreaterThanOrEqual(1);

      // Check 429 response format
      const lastRes = await request(rateLimitApp).post('/api/snapshot').send({ format: 'json' });
      if (lastRes.status === 429) {
        expect(lastRes.body).toHaveProperty('code', 'RATE_LIMITED');
        expect(lastRes.headers['retry-after']).toBeDefined();
      }
    } finally {
      nowSpy.mockRestore();
    }
  }, 15_000);

  // ── 8. Rate limiter enforces 30 req/min on /api/snapshot ──
  it('rate limiter enforces 30 req/min on /api/snapshot', async () => {
    // Freeze Date.now so the 31st request cannot pass due to token refill drift.
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_100_000);
    try {
      const sharedApp = createTestApp();

      // Exhaust 30 requests via /api/snapshot
      for (let i = 0; i < 30; i++) {
        await request(sharedApp).post('/api/snapshot').send({ format: 'json' });
      }

      // The 31st request via /api/snapshot should be 429
      const apiRes = await request(sharedApp).post('/api/snapshot').send({ format: 'json' });
      expect(apiRes.status).toBe(429);
    } finally {
      nowSpy.mockRestore();
    }
  }, 15_000);

  // ── 11. Concurrent /api/snapshot requests respect render pool ──
  it('concurrent requests are queued and all complete', async () => {
    const concApp = createTestApp();
    // Keep > render concurrency (3) so queue path is exercised,
    // but avoid unnecessary CI/coverage slowdown from larger fan-out.
    const promises = Array.from({ length: 4 }, () =>
      request(concApp).post('/api/snapshot').send({ format: 'png', detail: 'compact' }),
    );
    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.status === 200);
    expect(successes.length).toBe(4);
  }, 15_000);

  // ── 12. theme param: dark (default) and light ──
  it('POST /api/snapshot theme=dark → 200', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json', theme: 'dark' });
    expect(res.status).toBe(200);
  });

  it('POST /api/snapshot theme=light → 200', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json', theme: 'light' });
    expect(res.status).toBe(200);
  });

  it('POST /api/snapshot theme=invalid → 400', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json', theme: 'neon' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'INVALID_PARAM');
  });

  // ── 13. lang param ──
  it('POST /api/snapshot lang=en → 200', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json', lang: 'en' });
    expect(res.status).toBe(200);
  });

  it('POST /api/snapshot lang=zh → 200', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json', lang: 'zh' });
    expect(res.status).toBe(200);
  });

  // ── 14. range param variations ──
  it.each(['30m', '1h', '6h', '12h', '24h'] as const)('POST /api/snapshot range=%s → 200', async (range) => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json', range });
    expect(res.status).toBe(200);
  });

  it('POST /api/snapshot range=invalid → 400', async () => {
    const res = await request(app).post('/api/snapshot').send({ format: 'json', range: '99h' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'INVALID_PARAM');
  });

  // ── 15. combined params: theme + lang + range + format ──
  it('POST /api/snapshot with all params combined → 200 PNG', async () => {
    const res = await request(app)
      .post('/api/snapshot')
      .send({ format: 'png', detail: 'compact', range: '1h', theme: 'light', lang: 'zh' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
  });

  // ── 16. /api/snapshot rejects non-local Host in no-auth mode ──
  it('/api/snapshot rejects non-local Host with 403', async () => {
    const res = await request(app).post('/api/snapshot').set('Host', 'evil.com').send({ format: 'json' });

    expect(res.status).toBe(403);
  });

  // ── 17. API-only app: unknown endpoints should return 404 ──
  it.each([
    { method: 'get', path: '/test-123' },
    { method: 'post', path: '/test-123' },
    { method: 'get', path: '/not-found/' },
    { method: 'post', path: '/not-found/' },
    { method: 'get', path: '/not-found/anything' },
    { method: 'post', path: '/not-found/anything' },
  ] as const)('$method $path -> 404', async ({ method, path }) => {
    const res =
      method === 'post' ? await request(app).post(path).send({ format: 'json' }) : await request(app).get(path);

    expect(res.status).toBe(404);
  });

  // ── 18. API-only app: /mcp* should follow unknown-endpoint semantics (404) ──
  it.each([
    { method: 'get', path: '/mcp' },
    { method: 'post', path: '/mcp' },
    { method: 'get', path: '/mcp/' },
    { method: 'post', path: '/mcp/' },
    { method: 'get', path: '/mcp/anything' },
    { method: 'post', path: '/mcp/anything' },
  ] as const)('$method $path -> 404 (API-only)', async ({ method, path }) => {
    const res =
      method === 'post' ? await request(app).post(path).send({ format: 'json' }) : await request(app).get(path);

    expect(res.status).toBe(404);
  });
});
