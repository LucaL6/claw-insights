import type { NextFunction, Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockNext, createMockResponse } from './test-utils.js';

const mockConfig = vi.hoisted(() => ({ apiToken: '', noAuth: false, serverPort: 41041 }));
const mockLoadOrInitTokenState = vi.hoisted(() => vi.fn());
vi.mock('../config.js', () => ({ config: mockConfig, getDataDir: () => '/tmp/.claw-insights-test' }));
vi.mock('../auth/token-state-store.js', () => ({ loadOrInitTokenState: mockLoadOrInitTokenState }));

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
    path: '/graphql',
  } as unknown as Request;
}

const ACTIVE_KID = 'k-active';
const ACTIVE_DIGEST = 'a'.repeat(64);
const PREV_KID = 'k-prev';
const PREV_DIGEST = 'b'.repeat(64);

function tokenState(now: number, previousExpiresAtMs: number = now + 60_000) {
  return {
    enabled: true,
    activeKid: ACTIVE_KID,
    activeDigest: ACTIVE_DIGEST,
    previous: [{ kid: PREV_KID, digest: PREV_DIGEST, expiresAtMs: previousExpiresAtMs }],
    lastRotatedAtMs: now,
    rotationIntervalMs: 24 * 60 * 60 * 1000,
    graceMs: 12 * 60 * 60 * 1000,
    maxPrevious: 2,
    version: 1 as const,
  };
}

describe('authMiddleware', () => {
  let next: NextFunction;
  const TOKEN = 'a'.repeat(32);

  beforeEach(() => {
    next = createMockNext();
    mockConfig.apiToken = TOKEN;
    mockConfig.noAuth = false;
    mockConfig.serverPort = 41041;
    vi.restoreAllMocks();
    const now = Date.now();
    mockLoadOrInitTokenState.mockReturnValue(tokenState(now));
  });

  it('passes through when noAuth is true', () => {
    mockConfig.noAuth = true;
    authMiddleware(mockReq(), createMockResponse(), next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through with correct Bearer token (Bearer path unchanged)', () => {
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

  it('accepts active cookie', () => {
    authMiddleware(
      mockReq({ headers: { cookie: `claw_session=${ACTIVE_KID}:${ACTIVE_DIGEST}` }, method: 'GET' }),
      createMockResponse(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('accepts previous cookie within grace and sets refreshed cookie', () => {
    const res = createMockResponse();
    authMiddleware(
      mockReq({ headers: { cookie: `claw_session=${PREV_KID}:${PREV_DIGEST}` }, method: 'GET' }),
      res,
      next,
    );
    expect(next).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      'claw_session',
      `${ACTIVE_KID}:${ACTIVE_DIGEST}`,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' }),
    );
  });

  it('rejects previous cookie after grace', () => {
    const now = Date.now();
    mockLoadOrInitTokenState.mockReturnValue(tokenState(now, now - 1));
    const res = createMockResponse();

    authMiddleware(
      mockReq({ headers: { cookie: `claw_session=${PREV_KID}:${PREV_DIGEST}` }, method: 'GET' }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects malformed cookie values', () => {
    for (const value of ['foo', 'kid-only', ':digest-only']) {
      const res = createMockResponse();
      authMiddleware(mockReq({ headers: { cookie: `claw_session=${value}` }, method: 'GET' }), res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    }
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects legacy hash cookie without kid', () => {
    const res = createMockResponse();
    authMiddleware(mockReq({ headers: { cookie: `claw_session=${'c'.repeat(64)}` }, method: 'GET' }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes CSRF check with matching Origin header on POST (CSRF behavior unchanged)', () => {
    authMiddleware(
      mockReq({
        headers: {
          cookie: `claw_session=${ACTIVE_KID}:${ACTIVE_DIGEST}`,
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
          cookie: `claw_session=${ACTIVE_KID}:${ACTIVE_DIGEST}`,
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
        headers: { cookie: `claw_session=${ACTIVE_KID}:${ACTIVE_DIGEST}`, host: '127.0.0.1:41041' },
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
          cookie: `claw_session=${ACTIVE_KID}:${ACTIVE_DIGEST}`,
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

  it('returns 401 with no auth at all', () => {
    const res = createMockResponse();
    authMiddleware(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
