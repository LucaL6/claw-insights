import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInfo } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
}));

vi.mock('../../logger.js', () => ({
  createChildLogger: () => ({
    info: mockInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { requestAccessMiddleware } from '../request-access.js';

describe('requestAccessMiddleware', () => {
  beforeEach(() => {
    mockInfo.mockClear();
  });

  it('logs GraphQL request completion with request metadata', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestAccessMiddleware);
    app.post('/graphql', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).post('/graphql').send({ query: '{__typename}' }).expect(200);

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/graphql',
        status: 200,
        requestId: expect.any(String),
        durationMs: expect.any(Number),
      }),
      'http access',
    );
  });

  it('logs GraphQL request completion when path has trailing slash', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestAccessMiddleware);
    app.post('/graphql', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).post('/graphql/').send({ query: '{__typename}' }).expect(200);

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/graphql/',
        status: 200,
        requestId: expect.any(String),
        durationMs: expect.any(Number),
      }),
      'http access',
    );
  });

  it('logs REST API request completion with request metadata', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestAccessMiddleware);
    app.post('/api/snapshot', (_req, res) => {
      res.status(202).json({ queued: true });
    });

    await request(app).post('/api/snapshot').send({ format: 'json' }).expect(202);

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/snapshot',
        status: 202,
        requestId: expect.any(String),
        durationMs: expect.any(Number),
      }),
      'http access',
    );
  });

  it('replaces invalid x-request-id values with generated UUID', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestAccessMiddleware);
    app.post('/graphql', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app)
      .post('/graphql')
      .set('x-request-id', 'x'.repeat(256))
      .send({ query: '{__typename}' })
      .expect(200);

    const call = mockInfo.mock.calls[0];
    expect(call).toBeDefined();
    const payload = call[0] as { requestId: string };
    expect(payload.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('does not log non-target routes', async () => {
    const app = express();
    app.use(requestAccessMiddleware);
    app.get('/health', (_req, res) => {
      res.status(200).send('ok');
    });

    await request(app).get('/health').expect(200);

    expect(mockInfo).not.toHaveBeenCalled();
  });
});
