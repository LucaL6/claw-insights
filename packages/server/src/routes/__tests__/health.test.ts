import { describe, expect, it, vi } from 'vitest';

describe('health handler', () => {
  it('returns status ok with correct shape', async () => {
    const { createHealthHandler } = await import('../health.js');
    const handler = createHealthHandler({
      version: '0.9.0',
      serverOnly: false,
      checkGateway: async () => true,
      checkDb: () => true,
      checkReady: () => true,
    });

    const json = vi.fn();
    await handler({} as unknown as import('express').Request, { json } as unknown as import('express').Response);

    const body = json.mock.calls[0][0];
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.9.0');
    expect(body.mode).toBe('full');
    expect(body.gateway).toBe('connected');
    expect(body.db).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('returns server-only mode', async () => {
    const { createHealthHandler } = await import('../health.js');
    const handler = createHealthHandler({
      version: '0.9.0',
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
      version: '0.9.0',
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
      version: '0.9.0',
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
      version: '0.9.0',
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
});
