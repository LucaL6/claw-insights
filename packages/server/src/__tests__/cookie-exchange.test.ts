import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';

const mockConfig = vi.hoisted(() => ({ apiToken: 'a'.repeat(32), noAuth: false }));
vi.mock('../config.js', () => ({ config: mockConfig }));

import { cookieExchangeMiddleware } from '../middleware/cookie-exchange.js';

function mockReq(query: Record<string, string> = {}, path = '/'): Request {
  return { query, path, url: path + '?' + new URLSearchParams(query).toString() } as unknown as Request;
}

function mockRes() {
  const res: Record<string, unknown> = { headers: {} };
  res.status = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('cookieExchangeMiddleware', () => {
  let next: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    next = vi.fn();
    mockConfig.apiToken = 'a'.repeat(32);
    mockConfig.noAuth = false;
  });

  it('calls next() when no token query param', () => {
    cookieExchangeMiddleware(mockReq({}), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('sets cookie and redirects 303 for valid token', () => {
    const token = 'a'.repeat(32);
    const res = mockRes();
    cookieExchangeMiddleware(mockReq({ token }), res, next);
    expect(res.cookie).toHaveBeenCalledWith(
      'claw_session',
      createHash('sha256').update(token).digest('hex'),
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }),
    );
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.set).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(res.redirect).toHaveBeenCalledWith(303, '/');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for invalid token', () => {
    const res = mockRes();
    cookieExchangeMiddleware(mockReq({ token: 'wrong' }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when noAuth is true', () => {
    mockConfig.noAuth = true;
    cookieExchangeMiddleware(mockReq({ token: 'anything' }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
