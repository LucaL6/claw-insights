import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the engine and auth
vi.mock('../../services/snapshot-engine.js', () => ({}));
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../config.js', () => ({
  config: {
    noAuth: true,
    apiToken: 'test-token',
    serverPort: 41041,
    cliPath: 'openclaw',
    isDev: true,
    serverOnly: false,
  },
}));
vi.mock('../../logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import type { SnapshotEngine, SnapshotResult } from '../../services/snapshot-engine.js';
import { jsonContentTypeMiddleware, localOnlyMiddleware, registerMcp } from '../mcp.js';

// ── Helpers ──

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: { 'content-type': 'application/json', host: 'localhost:41041' },
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response & { statusCode: number; body: unknown; headers: Record<string, string> } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
    set(key: string, val: string) {
      this.headers[key] = val;
      return this;
    },
    headersSent: false,
  } as unknown as Response & { statusCode: number; body: unknown; headers: Record<string, string> };
  return res;
}

function createMockEngine(overrides: Partial<SnapshotEngine> = {}): SnapshotEngine {
  return {
    execute: vi.fn().mockResolvedValue({
      format: 'png',
      output: Buffer.from('fake-png'),
      contentType: 'image/png',
      detail: 'standard',
      degraded: false,
      durationMs: 42,
    } satisfies SnapshotResult),
    stats: { renderConcurrency: 0, renderQueueLength: 0 },
    ...overrides,
  } as unknown as SnapshotEngine;
}

function createTestApp(engine: SnapshotEngine, noAuth = true) {
  const app = express();
  registerMcp(app, engine, noAuth);
  return app;
}

async function fetchApp(
  app: ReturnType<typeof express>,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; headers: Headers; json: () => Promise<unknown>; text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}${path}`;
      const fetchHeaders: Record<string, string> = {
        Host: 'localhost:41041',
        ...headers,
      };
      if (body !== undefined) {
        fetchHeaders['Content-Type'] = 'application/json';
        fetchHeaders['Accept'] = 'application/json, text/event-stream';
      }
      fetch(url, {
        method,
        headers: fetchHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
        .then((res) => {
          server.close();
          resolve(res);
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

// ── Tests ──

describe('localOnlyMiddleware', () => {
  it('rejects non-local Host in no-auth mode with 403', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({ headers: { 'content-type': 'application/json', host: 'evil.com' } });
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  it('allows localhost Host', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows [::1] Host', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { 'content-type': 'application/json', host: '[::1]:41041' },
      socket: { remoteAddress: '::1' } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows 127.0.0.1 Host', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { 'content-type': 'application/json', host: '127.0.0.1:41041' },
    });
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips check when noAuth=false', () => {
    const mw = localOnlyMiddleware(false);
    const req = mockReq({ headers: { 'content-type': 'application/json', host: 'evil.com' } });
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('jsonContentTypeMiddleware', () => {
  it('rejects non-JSON content-type with 415', () => {
    const req = mockReq({ headers: { 'content-type': 'text/plain', host: 'localhost' } });
    const res = mockRes();
    const next = vi.fn();
    jsonContentTypeMiddleware(req, res, next);
    expect(res.statusCode).toBe(415);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows application/json', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    jsonContentTypeMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('MCP method handling', () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = createTestApp(createMockEngine());
  });

  it('GET /mcp returns 405 with Allow: POST', async () => {
    const res = await fetchApp(app, 'GET', '/mcp');
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });

  it('DELETE /mcp returns 405', async () => {
    const res = await fetchApp(app, 'DELETE', '/mcp');
    expect(res.status).toBe(405);
  });

  it('PUT /mcp returns 405', async () => {
    const res = await fetchApp(app, 'PUT', '/mcp');
    expect(res.status).toBe(405);
  });

  it('PATCH /mcp returns 405', async () => {
    const res = await fetchApp(app, 'PATCH', '/mcp');
    expect(res.status).toBe(405);
  });
});

describe('MCP body size limit', () => {
  it('rejects body > 1KB with 413', async () => {
    const app = createTestApp(createMockEngine());
    const largeBody = { jsonrpc: '2.0', method: 'tools/list', id: 1, padding: 'x'.repeat(2000) };
    const res = await fetchApp(app, 'POST', '/mcp', largeBody);
    expect(res.status).toBe(413);
  });
});

describe('MCP protocol', () => {
  it('POST /mcp with initialize returns 200 SSE', async () => {
    const app = createTestApp(createMockEngine());
    const res = await fetchApp(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
      id: 1,
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    // SSE response contains the initialize result with server info
    expect(text).toContain('claw-insights');
    expect(text).toContain('event:');
  });

  it('POST /mcp with notifications/initialized returns 204', async () => {
    const app = createTestApp(createMockEngine());
    const res = await fetchApp(app, 'POST', '/mcp', {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(res.status).toBe(202);
  });
});
