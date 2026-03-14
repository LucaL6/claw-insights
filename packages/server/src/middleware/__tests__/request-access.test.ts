import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInfo, mockWarn, mockError } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock('../../logger.js', () => ({
  createChildLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    debug: vi.fn(),
  }),
}));

import { requestAccessMiddleware } from '../request-access.js';
import { shouldEmitAccessLog } from '../request-access-utils.js';

function findRequestId(emit: boolean, endpoint = 'graphql', operationName = 'ViewerQuery'): string {
  for (let i = 0; i < 500; i += 1) {
    const id = `r-${i}`;
    const decision = shouldEmitAccessLog({
      status: 200,
      durationMs: 20,
      requestId: id,
      endpoint,
      operationName,
    });
    if (decision.emit === emit) {
      return id;
    }
  }

  throw new Error(`unable to find request id for emit=${emit}`);
}

describe('requestAccessMiddleware', () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
  });

  it('logs GraphQL request completion with strict-safe metadata fields', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestAccessMiddleware);
    app.post('/graphql', (_req, res) => res.status(200).json({ ok: true }));

    await request(app)
      .post('/graphql?token=secret')
      .set('x-request-id', findRequestId(true))
      .send({ query: '{__typename}', variables: { token: 'secret' } })
      .expect(200);

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        endpoint: 'graphql',
        urlPath: '/graphql',
        host: '127.0.0.1',
        status: 200,
        statusClass: '2xx',
        requestId: expect.any(String),
        durationMs: expect.any(Number),
      }),
      'http access',
    );

    const payload = mockInfo.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.urlPath).toBe('/graphql');
    expect(payload.urlPath).not.toContain('?');
    expect(payload.query).toBeUndefined();
    expect(payload.variables).toBeUndefined();
    expect(payload.headers).toBeUndefined();
  });

  it('captures GraphQL operationName fallback and document hash without leaking query text', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestAccessMiddleware);
    app.post('/graphql', (_req, res) => res.status(200).json({ ok: true }));

    await request(app)
      .post('/graphql')
      .set('x-request-id', findRequestId(true))
      .send({ query: 'query ViewerQuery { viewer { id } }' })
      .expect(200);

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'graphql',
        operationName: 'ViewerQuery',
        documentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      'http access',
    );

    const payload = mockInfo.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.query).toBeUndefined();
    expect(payload.body).toBeUndefined();
  });

  it('derives host from allowlisted sources only (host primary, x-forwarded-host fallback)', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      delete req.headers.host;
      next();
    });
    app.use(requestAccessMiddleware);
    app.post('/api/snapshot', (_req, res) => res.status(202).json({ queued: true }));

    await request(app)
      .post('/api/snapshot')
      .set('x-request-id', findRequestId(true, 'snapshot', 'anonymous'))
      .set('x-forwarded-host', 'api.example.com, proxy.internal')
      .set('x-not-allowlisted-host', 'evil.example.com')
      .send({ format: 'json' })
      .expect(202);

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'snapshot',
        urlPath: '/api/snapshot',
        host: 'api.example.com',
        statusClass: '2xx',
      }),
      'http access',
    );

    const payload = mockInfo.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['x-not-allowlisted-host']).toBeUndefined();
  });

  it('includes statusClass for non-2xx responses', async () => {
    const app = express();
    app.use(requestAccessMiddleware);
    app.get('/api/legacy', (_req, res) => res.status(404).json({ error: 'not found' }));

    await request(app).get('/api/legacy').expect(404);

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'api', urlPath: '/api/legacy', status: 404, statusClass: '4xx' }),
      'http access',
    );
  });

  it('adds graphql operation metadata and deterministic sample reason', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestAccessMiddleware);
    app.post('/graphql', (_req, res) => res.status(200).json({ ok: true }));

    await request(app)
      .post('/graphql')
      .set('x-request-id', findRequestId(true))
      .send({ query: 'query ViewerQuery { viewer { id } }' })
      .expect(200);

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        operationName: 'ViewerQuery',
        operationType: 'query',
        opParseError: false,
        sampleReason: 'sampled',
      }),
      'http access',
    );
  });

  it('applies deterministic sampling for success logs but never drops warn/error logs', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestAccessMiddleware);
    app.post('/graphql', (_req, res) => res.status(200).json({ ok: true }));
    app.get('/api/legacy', (_req, res) => res.status(404).json({ error: 'not found' }));

    const droppedRequestId = findRequestId(false);

    await request(app)
      .post('/graphql')
      .set('x-request-id', droppedRequestId)
      .send({ query: 'query ViewerQuery { viewer { id } }' })
      .expect(200);
    expect(mockInfo).not.toHaveBeenCalled();

    await request(app).get('/api/legacy').set('x-request-id', droppedRequestId).expect(404);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'api', statusClass: '4xx' }),
      'http access',
    );
  });

  it('does not log non-target routes', async () => {
    const app = express();
    app.use(requestAccessMiddleware);
    app.get('/health', (_req, res) => res.status(200).send('ok'));

    await request(app).get('/health').expect(200);

    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('always emits for 4xx/5xx with error reason', () => {
    expect(
      shouldEmitAccessLog({ status: 404, durationMs: 10, requestId: 'a', endpoint: 'api', operationName: 'anonymous' }),
    ).toEqual({ emit: true, sampleReason: 'error' });
    expect(
      shouldEmitAccessLog({
        status: 500,
        durationMs: 10,
        requestId: 'b',
        endpoint: 'graphql',
        operationName: 'ViewerQuery',
      }),
    ).toEqual({ emit: true, sampleReason: 'error' });
  });

  it('always emits slow requests first with slow reason', () => {
    expect(
      shouldEmitAccessLog({
        status: 500,
        durationMs: 1001,
        requestId: 'c',
        endpoint: 'graphql',
        operationName: 'ViewerQuery',
      }),
    ).toEqual({ emit: true, sampleReason: 'slow' });
  });

  it('samples 2xx/3xx deterministically at 30%', () => {
    const one = shouldEmitAccessLog({
      status: 200,
      durationMs: 20,
      requestId: 'stable-id',
      endpoint: 'graphql',
      operationName: 'ViewerQuery',
    });
    const two = shouldEmitAccessLog({
      status: 200,
      durationMs: 20,
      requestId: 'stable-id',
      endpoint: 'graphql',
      operationName: 'ViewerQuery',
    });
    expect(two).toEqual(one);

    const reasons = Array.from(
      { length: 40 },
      (_, i) =>
        shouldEmitAccessLog({
          status: 302,
          durationMs: 20,
          requestId: `stable-${i}`,
          endpoint: 'graphql',
          operationName: 'ViewerQuery',
        }).sampleReason,
    );
    expect(reasons).toContain('sampled');
    expect(reasons).toContain('dropped');
  });

  // Removed: CRLF injection test — supertest/Node rejects CRLF in headers before reaching middleware

  it('uses valid x-request-id when provided', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestAccessMiddleware);
    app.post('/graphql', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app)
      .post('/graphql')
      .set('x-request-id', 'my-custom-id-123')
      .send({ query: '{__typename}' })
      .expect(200);

    const call = mockInfo.mock.calls[0];
    const payload = call[0] as { requestId: string };
    expect(payload.requestId).toBe('my-custom-id-123');
  });
});
