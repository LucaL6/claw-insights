/**
 * Health integration tests — verify HTTP endpoint via supertest.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>();
  return {
    ...original,
    config: { ...original.config, noAuth: true },
  };
});

import express from 'express';
import request from 'supertest';

import { createHealthHandler } from '../routes/health.js';

describe('GET /health', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.get(
      '/health',
      createHealthHandler({
        version: '1.0.0-test',
        serverOnly: false,
        checkGateway: async () => true,
        checkDb: () => true,
        checkReady: () => true,
      }),
    );
  });

  it('returns 200 with { status, version, uptime }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('uptime');
  });

  it('status field is a string', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.status).toBe('string');
  });

  it('version is a string', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.version).toBe('string');
    expect(res.body.version).toBe('1.0.0-test');
  });

  it('uptime is a number >= 0', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });
});
