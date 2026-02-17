import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const mockConfig = vi.hoisted(() => ({ apiToken: '' }));
vi.mock('../config.js', () => ({ config: mockConfig }));

import { authMiddleware } from '../middleware/auth.js';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('authMiddleware', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
  });

  it('passes through when no token configured', () => {
    mockConfig.apiToken = '';
    authMiddleware(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when token configured but no header', () => {
    mockConfig.apiToken = 'secret';
    const res = mockRes();
    authMiddleware(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token is wrong', () => {
    mockConfig.apiToken = 'secret';
    const res = mockRes();
    authMiddleware(mockReq({ authorization: 'Bearer wrong' }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through with correct token', () => {
    mockConfig.apiToken = 'secret';
    authMiddleware(mockReq({ authorization: 'Bearer secret' }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 for malformed header (no Bearer prefix)', () => {
    mockConfig.apiToken = 'secret';
    const res = mockRes();
    authMiddleware(mockReq({ authorization: 'Basic secret' }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
