import { createHash } from 'node:crypto';

import type { NextFunction, Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockNext,createMockResponse } from './test-utils.js';

const mockConfig = vi.hoisted(() => ({ apiToken: '', noAuth: false, serverPort: 41041 }));
vi.mock('../config.js', () => ({ config: mockConfig }));

import { authMiddleware } from '../middleware/auth.js';

function mockReq(
  opts: {
    headers?: Record<string, string>;
    method?: string;
  } = {},
): Request {
  return {
    headers: opts.headers ?? {},
    method: opts.method ?? 'GET',
  } as unknown as Request;
}

describe('authMiddleware', () => {
  let next: NextFunction;
  const TOKEN = 'a'.repeat(32);
  const COOKIE_HASH = createHash('sha256').update(TOKEN).digest('hex');

  beforeEach(() => {
    next = createMockNext();
    mockConfig.apiToken = TOKEN;
    mockConfig.noAuth = false;
    mockConfig.serverPort = 41041;
  });

  // --- noAuth mode ---
  it('passes through when noAuth is true', () => {
    mockConfig.noAuth = true;
    authMiddleware(mockReq(), createMockResponse(), next);
    expect(next).toHaveBeenCalled();
  });

  // --- Bearer auth ---
  it('passes through with correct Bearer token', () => {
    authMiddleware(mockReq({ headers: { authorization: `Bearer ${TOKEN}` } }), createMockResponse(), next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for wrong Bearer token', () => {
    const res = createMockResponse();
    authMiddleware(mockReq({ headers: { authorization: 'Bearer wrong' } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for malformed auth header', () => {
    const res = createMockResponse();
    authMiddleware(mockReq({ headers: { authorization: 'Basic secret' } }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // --- Cookie auth ---
  it('passes through with valid cookie (GET)', () => {
    authMiddleware(
      mockReq({ headers: { cookie: `claw_session=${COOKIE_HASH}` }, method: 'GET' }),
      createMockResponse(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 with invalid cookie', () => {
    const res = createMockResponse();
    authMiddleware(mockReq({ headers: { cookie: 'claw_session=invalid' }, method: 'GET' }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // --- CSRF check (cookie auth + state-changing) ---
  it('passes CSRF check with matching Origin header on POST', () => {
    authMiddleware(
      mockReq({
        headers: {
          cookie: `claw_session=${COOKIE_HASH}`,
          origin: 'http://127.0.0.1:41041',
          host: '127.0.0.1:41041',
        },
        method: 'POST',
      }),
      createMockResponse(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('fails CSRF check with wrong Origin on POST', () => {
    const res = createMockResponse();
    authMiddleware(
      mockReq({
        headers: {
          cookie: `claw_session=${COOKIE_HASH}`,
          origin: 'http://evil.com',
          host: '127.0.0.1:41041',
        },
        method: 'POST',
      }),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails CSRF check with no Origin/Referer on POST', () => {
    const res = createMockResponse();
    authMiddleware(
      mockReq({
        headers: { cookie: `claw_session=${COOKIE_HASH}`, host: '127.0.0.1:41041' },
        method: 'POST',
      }),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('passes CSRF check with matching Referer on POST', () => {
    authMiddleware(
      mockReq({
        headers: {
          cookie: `claw_session=${COOKIE_HASH}`,
          referer: 'http://127.0.0.1:41041/dashboard',
          host: '127.0.0.1:41041',
        },
        method: 'POST',
      }),
      createMockResponse(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  // --- No credentials at all ---
  it('returns 401 with no auth at all', () => {
    const res = createMockResponse();
    authMiddleware(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
