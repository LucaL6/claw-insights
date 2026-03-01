import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/snapshot-engine.js', () => ({}));
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../config.js', () => ({
  config: {
    noAuth: false,
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
import {
  CollectTimeoutError,
  GatewayUnreachableError,
  PayloadTooLargeError,
  QueueFullError,
  QueueTimeoutError,
  RateLimitedError,
  TotalTimeoutError,
} from '../../utils/snapshot-errors.js';
import { jsonContentTypeMiddleware, localOnlyMiddleware, registerMcp } from '../mcp.js';

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
    status(this: { statusCode: number }, code: number) {
      this.statusCode = code;
      return this;
    },
    json(this: { body: unknown }, data: unknown) {
      this.body = data;
      return this;
    },
    set(this: { headers: Record<string, string> }, key: string, val: string) {
      this.headers[key] = val;
      return this;
    },
    headersSent: false,
  } as unknown as Response & { statusCode: number; body: unknown; headers: Record<string, string> };
  return res;
}

describe('localOnlyMiddleware branches', () => {
  it('rejects local host but non-local remoteAddress', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { 'content-type': 'application/json', host: 'localhost:41041' },
      socket: { remoteAddress: '192.168.1.1' } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('handles missing host header', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    // Empty host → not in VALID_LOCAL_HOSTS → 403
    expect(res.statusCode).toBe(403);
  });

  it('handles IPv6-mapped IPv4 loopback (::ffff:127.0.0.1)', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { 'content-type': 'application/json', host: 'localhost:41041' },
      socket: { remoteAddress: '::ffff:127.0.0.1' } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('handles missing remoteAddress', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { 'content-type': 'application/json', host: 'localhost:41041' },
      socket: { remoteAddress: undefined } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

describe('jsonContentTypeMiddleware branches', () => {
  it('rejects missing content-type header', () => {
    const req = mockReq({ headers: { host: 'localhost' } });
    const res = mockRes();
    const next = vi.fn();
    jsonContentTypeMiddleware(req, res, next);
    expect(res.statusCode).toBe(415);
  });
});

describe('MCP snapshot tool error branches', () => {
  let currentError: Error;

  function createMockEngine(): SnapshotEngine {
    return {
      execute: () => Promise.reject(currentError),
      stats: { renderConcurrency: 0, renderQueueLength: 0 },
    } as unknown as SnapshotEngine;
  }

  let sharedServer: ReturnType<typeof import('http').createServer>;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    const engine = createMockEngine();
    registerMcp(app, engine, true);
    await new Promise<void>((resolve) => {
      sharedServer = app.listen(0, '127.0.0.1', () => {
        const addr = sharedServer.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}/mcp`;
        resolve();
      });
    });
  });

  afterAll(() => {
    sharedServer?.close();
  });

  async function callSnapshotTool(): Promise<{ status: number; text: string }> {
    // Initialize
    await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:41041',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
        id: 1,
      }),
    });
    // Call tool
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:41041',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'snapshot', arguments: {} },
        id: 2,
      }),
    });
    const text = await res.text();
    return { status: res.status, text };
  }

  const errorCases: Array<{ name: string; error: Error; expectedMessage: string }> = [
    { name: 'RateLimitedError', error: new RateLimitedError(5000), expectedMessage: 'Rate limited' },
    { name: 'QueueFullError', error: new QueueFullError(10), expectedMessage: 'Server is busy' },
    { name: 'QueueTimeoutError', error: new QueueTimeoutError(), expectedMessage: 'Server is busy' },
    { name: 'CollectTimeoutError', error: new CollectTimeoutError(), expectedMessage: 'Data collection timed out' },
    {
      name: 'GatewayUnreachableError',
      error: new GatewayUnreachableError(),
      expectedMessage: 'Gateway is not reachable',
    },
    { name: 'TotalTimeoutError', error: new TotalTimeoutError(), expectedMessage: 'Snapshot timeout' },
    { name: 'PayloadTooLargeError', error: new PayloadTooLargeError(), expectedMessage: 'Output too large' },
    { name: 'generic Error', error: new Error('unknown'), expectedMessage: 'Snapshot generation failed' },
  ];

  for (const { name, error, expectedMessage } of errorCases) {
    it(`handles ${name}`, async () => {
      currentError = error;
      const result = await callSnapshotTool();
      expect(result.status).toBe(200);
      expect(result.text).toContain(expectedMessage);
    });
  }

  it('handles json format result', async () => {
    currentError = undefined as any; // won't be used — override engine for this test
    // Need separate server for success cases
    const engine = {
      execute: () =>
        Promise.resolve({
          format: 'json' as const,
          output: { test: true },
          contentType: 'application/json',
          detail: 'standard',
          degraded: false,
          durationMs: 42,
        } as SnapshotResult),
      stats: { renderConcurrency: 0, renderQueueLength: 0 },
    } as unknown as SnapshotEngine;
    const app = express();
    registerMcp(app, engine, true);
    const srv = await new Promise<ReturnType<typeof import('http').createServer>>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = srv.address() as { port: number };
    const url = `http://127.0.0.1:${addr.port}/mcp`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:41041',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
        id: 1,
      }),
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:41041',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'snapshot', arguments: {} },
        id: 2,
      }),
    });
    const text = await res.text();
    srv.close();
    expect(text).toContain('test');
  });

  it('handles svg format result', async () => {
    const engine = {
      execute: () =>
        Promise.resolve({
          format: 'svg' as const,
          output: '<svg></svg>',
          contentType: 'image/svg+xml',
          detail: 'standard',
          degraded: false,
          durationMs: 42,
        } as SnapshotResult),
      stats: { renderConcurrency: 0, renderQueueLength: 0 },
    } as unknown as SnapshotEngine;
    const app = express();
    registerMcp(app, engine, true);
    const srv = await new Promise<ReturnType<typeof import('http').createServer>>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = srv.address() as { port: number };
    const url = `http://127.0.0.1:${addr.port}/mcp`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:41041',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
        id: 1,
      }),
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'localhost:41041',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'snapshot', arguments: {} },
        id: 2,
      }),
    });
    const text = await res.text();
    srv.close();
    expect(text).toContain('image/svg+xml');
  });
});

describe('registerMcp with auth', () => {
  it('registers routes with auth middleware when noAuth=false', async () => {
    const engine = {
      execute: vi.fn().mockResolvedValue({
        format: 'png',
        output: Buffer.from('fake'),
        contentType: 'image/png',
        detail: 'standard',
        degraded: false,
        durationMs: 42,
      }),
      stats: { renderConcurrency: 0, renderQueueLength: 0 },
    } as unknown as SnapshotEngine;

    const app = express();
    registerMcp(app, engine, false);

    // Should work — noAuth=false means localOnly check is skipped
    const result = await new Promise<{ status: number }>((resolve, reject) => {
      const server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        fetch(`http://127.0.0.1:${addr.port}/mcp`, {
          method: 'GET',
          headers: { Host: 'localhost:41041' },
        })
          .then((res) => {
            server.close();
            resolve({ status: res.status });
          })
          .catch((err) => {
            server.close();
            reject(err);
          });
      });
    });
    expect(result.status).toBe(405);
  });
});
