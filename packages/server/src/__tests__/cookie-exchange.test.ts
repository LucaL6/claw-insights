import type { NextFunction, Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockNext, createMockResponse } from './test-utils.js';

const mockConfig = vi.hoisted(() => ({ apiToken: 'a'.repeat(32), noAuth: false }));
const loadOrInitTokenStateMock = vi.hoisted(() => vi.fn());
const mockGetDataDir = vi.hoisted(() => vi.fn(() => '/tmp/.claw-insights-test'));

vi.mock('../config.js', () => ({ config: mockConfig, getDataDir: mockGetDataDir }));
vi.mock('../auth/token-state-store.js', () => ({
  loadOrInitTokenState: loadOrInitTokenStateMock,
}));

import { cookieExchangeMiddleware } from '../middleware/cookie-exchange.js';

function mockReq(query: Record<string, string> = {}, path = '/'): Request {
  return { query, path, url: path + '?' + new URLSearchParams(query).toString() } as unknown as Request;
}

describe('cookieExchangeMiddleware', () => {
  let next: NextFunction;
  beforeEach(() => {
    next = createMockNext();
    mockConfig.apiToken = 'a'.repeat(32);
    mockConfig.noAuth = false;
    loadOrInitTokenStateMock.mockReset();
    mockGetDataDir.mockReset();
    mockGetDataDir.mockReturnValue('/tmp/.claw-insights-test');
    loadOrInitTokenStateMock.mockReturnValue({
      enabled: true,
      activeKid: 'k-test',
      activeDigest: 'd'.repeat(64),
      previous: [],
      lastRotatedAtMs: 0,
      rotationIntervalMs: 24 * 60 * 60 * 1000,
      graceMs: 12 * 60 * 60 * 1000,
      maxPrevious: 2,
      version: 1,
    });
  });

  it('calls next() when no token query param', () => {
    cookieExchangeMiddleware(mockReq({}), createMockResponse(), next);
    expect(next).toHaveBeenCalled();
  });

  it('sets kid:digest cookie and redirects 303 for valid token', () => {
    const token = 'a'.repeat(32);
    const res = createMockResponse();

    cookieExchangeMiddleware(mockReq({ token }), res, next);

    expect(res.cookie).toHaveBeenCalledWith(
      'claw_session',
      'k-test:' + 'd'.repeat(64),
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }),
    );
    expect(loadOrInitTokenStateMock).toHaveBeenCalledWith(
      '/tmp/.claw-insights-test/config.json',
      token,
      expect.any(Number),
    );
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.set).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(res.redirect).toHaveBeenCalledWith(303, '/');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for invalid token', () => {
    const res = createMockResponse();
    cookieExchangeMiddleware(mockReq({ token: 'wrong' }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when noAuth is true', () => {
    mockConfig.noAuth = true;
    cookieExchangeMiddleware(mockReq({ token: 'anything' }), createMockResponse(), next);
    expect(next).toHaveBeenCalled();
  });
});
