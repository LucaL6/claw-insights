import { describe, expect, it, vi } from 'vitest';

describe('health handler', () => {
  it('returns status ok with correct shape', async () => {
    const { createHealthHandler } = await import('../health.js');
    const handler = createHealthHandler({
      version: '0.1.0',
      serverOnly: false,
      checkGateway: async () => true,
      checkDb: () => true,
      checkReady: () => true,
    });

    const json = vi.fn();
    await handler({} as unknown as import('express').Request, { json } as unknown as import('express').Response);

    const body = json.mock.calls[0][0];
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(body.mode).toBe('full');
    expect(body.gateway).toBe('connected');
    expect(body.db).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('returns server-only mode', async () => {
    const { createHealthHandler } = await import('../health.js');
    const handler = createHealthHandler({
      version: '0.1.0',
      serverOnly: true,
      checkGateway: async () => false,
      checkDb: () => true,
      checkReady: () => true,
    });

    const json = vi.fn();
    await handler({} as unknown as import('express').Request, { json } as unknown as import('express').Response);

    const body = json.mock.calls[0][0];
    expect(body.mode).toBe('server-only');
    expect(body.gateway).toBe('disconnected');
  });

  it('reports db error', async () => {
    const { createHealthHandler } = await import('../health.js');
    const handler = createHealthHandler({
      version: '0.1.0',
      serverOnly: false,
      checkGateway: async () => true,
      checkDb: () => false,
      checkReady: () => true,
    });

    const json = vi.fn();
    await handler({} as unknown as import('express').Request, { json } as unknown as import('express').Response);

    const body = json.mock.calls[0][0];
    expect(body.db).toBe('error');
  });

  it('returns starting status when not ready (skips gateway check)', async () => {
    const { createHealthHandler } = await import('../health.js');
    const checkGateway = vi.fn(async () => true);
    const handler = createHealthHandler({
      version: '0.1.0',
      serverOnly: false,
      checkGateway,
      checkDb: () => true,
      checkReady: () => false,
    });

    const json = vi.fn();
    await handler({} as unknown as import('express').Request, { json } as unknown as import('express').Response);

    const body = json.mock.calls[0][0];
    expect(body.status).toBe('starting');
    expect(body.gateway).toBe('pending');
    expect(body.db).toBe('ok');
    expect(checkGateway).not.toHaveBeenCalled();
  });

  it('returns gateway disconnected when checkGateway throws (L15 catch)', async () => {
    const { createHealthHandler } = await import('../health.js');
    const handler = createHealthHandler({
      version: '0.1.0',
      serverOnly: false,
      checkGateway: async () => {
        throw new Error('connection refused');
      },
      checkDb: () => true,
      checkReady: () => true,
    });

    const json = vi.fn();
    await handler({} as any, { json } as any);

    const body = json.mock.calls[0][0];
    expect(body.gateway).toBe('disconnected');
  });

  it('includes logging payload when getLoggingHealth is provided', async () => {
    const { createHealthHandler } = await import('../health.js');
    const handler = createHealthHandler({
      version: '0.1.0',
      serverOnly: false,
      checkGateway: async () => true,
      checkDb: () => true,
      checkReady: () => true,
      getLoggingHealth: () => ({
        ts: 123,
        pressureState: 'normal',
        queue: { criticalDepth: 1, criticalCapacity: 10, bestEffortDepth: 2, bestEffortCapacity: 20 },
        drops: { debug: 0, info: 0, warn: 0, error: 0 },
        totals: { accepted: 10, dropped: 0 },
        pressureTransitions: 0,
        lastTransitionAt: null,
        signals: { queueUsageCriticalPct: 10, ioLagMs: 0, budgetUsagePct: 20, freeSpaceMb: 1024 },
      }),
    });

    const json = vi.fn();
    await handler({} as any, { json } as any);

    const body = json.mock.calls[0][0];
    expect(body.logging).toEqual({
      ts: 123,
      pressureState: 'normal',
      queue: { criticalDepth: 1, criticalCapacity: 10, bestEffortDepth: 2, bestEffortCapacity: 20 },
      drops: { debug: 0, info: 0, warn: 0, error: 0 },
      totals: { accepted: 10, dropped: 0 },
      pressureTransitions: 0,
      lastTransitionAt: null,
      signals: { queueUsageCriticalPct: 10, ioLagMs: 0, budgetUsagePct: 20, freeSpaceMb: 1024 },
    });
  });

  it('includes loggingFreshnessSec and keeps it <= 10s', async () => {
    const { createHealthHandler } = await import('../health.js');
    const nowTs = Date.now();
    const handler = createHealthHandler({
      version: '0.1.0',
      serverOnly: false,
      checkGateway: async () => true,
      checkDb: () => true,
      checkReady: () => true,
      getLoggingHealth: () => ({
        ts: nowTs - 3_000,
        pressureState: 'normal',
        queue: { criticalDepth: 0, criticalCapacity: 10, bestEffortDepth: 0, bestEffortCapacity: 20 },
        drops: { debug: 0, info: 0, warn: 0, error: 0 },
        totals: { accepted: 1, dropped: 0 },
        pressureTransitions: 0,
        lastTransitionAt: null,
        signals: { queueUsageCriticalPct: 0, ioLagMs: 0, budgetUsagePct: 10, freeSpaceMb: 1024 },
      }),
    });

    const json = vi.fn();
    await handler({} as any, { json } as any);

    const body = json.mock.calls[0][0] as { loggingFreshnessSec?: number };
    expect(body.loggingFreshnessSec).toBeLessThanOrEqual(10);
  });
});
