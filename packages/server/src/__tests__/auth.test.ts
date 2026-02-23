import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';

const mockConfig = vi.hoisted(() => ({ apiToken: '', noAuth: false, serverPort: 4000 }));
vi.mock('../config.js', () => ({ config: mockConfig }));

import { authMiddleware } from '../middleware/auth.js';

function mockReq(opts: {
  headers?: Record<string, string>;
  method?: string;
} = {}): Request {
  return {
    headers: opts.headers ?? {},
    method: opts.method ?? 'GET',
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('authMiddleware', () => {
  let next: ReturnType<typeof vi.fn>;
  const TOKEN = 'a'.repeat(32);
  const COOKIE_HASH = createHash('sha256').update(TOKEN).digest('hex');

  beforeEach(() => {
    next = vi.fn();
    mockConfig.apiToken = TOKEN;
    mockConfig.noAuth = false;
    mockConfig.serverPort = 4000;
  });

  // --- noAuth mode ---
  it('passes through when noAuth is true', () => {
    mockConfig.noAuth = true;
    authMiddleware(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  // --- Bearer auth ---
  it('passes through with correct Bearer token', () => {
    authMiddleware(mockReq({ headers: { authorization: `Bearer ${TOKEN}` } }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for wrong Bearer token', () => {
    const res = mockRes();
    authMiddleware(mockReq({ headers: { authorization: 'Bearer wrong' } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for malformed auth header', () => {
    const res = mockRes();
    authMiddleware(mockReq({ headers: { authorization: 'Basic secret' } }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // --- Cookie auth ---
  it('passes through with valid cookie (GET)', () => {
    authMiddleware(
      mockReq({ headers: { cookie: `claw_session=${COOKIE_HASH}` }, method: 'GET' }),
      mockRes(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 with invalid cookie', () => {
    const res = mockRes();
    authMiddleware(
      mockReq({ headers: { cookie: 'claw_session=invalid' }, method: 'GET' }),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // --- CSRF check (cookie auth + state-changing) ---
  it('passes CSRF check with matching Origin header on POST', () => {
    authMiddleware(
      mockReq({
        headers: {
          cookie: `claw_session=${COOKIE_HASH}`,
          origin: 'http://127.0.0.1:4000',
          host: '127.0.0.1:4000',
        },
        method: 'POST',
      }),
      mockRes(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('fails CSRF check with wrong Origin on POST', () => {
    const res = mockRes();
    authMiddleware(
      mockReq({
        headers: {
          cookie: `claw_session=${COOKIE_HASH}`,
          origin: 'http://evil.com',
          host: '127.0.0.1:4000',
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
    const res = mockRes();
    authMiddleware(
      mockReq({
        headers: { cookie: `claw_session=${COOKIE_HASH}`, host: '127.0.0.1:4000' },
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
          referer: 'http://127.0.0.1:4000/dashboard',
          host: '127.0.0.1:4000',
        },
        method: 'POST',
      }),
      mockRes(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  // --- No credentials at all ---
  it('returns 401 with no auth at all', () => {
    const res = mockRes();
    authMiddleware(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
