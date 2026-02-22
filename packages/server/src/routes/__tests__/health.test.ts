import { describe, it, expect, vi } from 'vitest';

describe('health handler', () => {
  it('returns status ok with correct shape', async () => {
    const { createHealthHandler } = await import('../health.js');
    const handler = createHealthHandler({
      version: '0.1.0',
      serverOnly: false,
      checkGateway: async () => true,
      checkDb: () => true,
    });

    const json = vi.fn();
    await handler({} as any, { json } as any);

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
    });

    const json = vi.fn();
    await handler({} as any, { json } as any);

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
    });

    const json = vi.fn();
    await handler({} as any, { json } as any);

    const body = json.mock.calls[0][0];
    expect(body.db).toBe('error');
  });
});
