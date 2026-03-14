import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { localOnlyMiddleware } from '../local-only.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/api/snapshot',
    headers: { host: 'localhost:4000' },
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response & { statusCode: number; body: unknown } {
  return {
    statusCode: 200,
    body: undefined,
    status(this: { statusCode: number }, code: number) {
      this.statusCode = code;
      return this;
    },
    json(this: { body: unknown }, data: unknown) {
      this.body = data;
      return this;
    },
  } as unknown as Response & { statusCode: number; body: unknown };
}

describe('localOnlyMiddleware', () => {
  it('noAuth=true + Host=evil.com -> 403', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({ headers: { host: 'evil.com' } });
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next as unknown as NextFunction);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('noAuth=true + Host=127.0.0.1 -> next()', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({ headers: { host: '127.0.0.1' } });
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('noAuth=true + Host=localhost:4000 -> next()', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({ headers: { host: 'localhost:4000' } });
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('noAuth=true + Host=[::1]:4000 + remoteAddress=::1 -> next()', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { host: '[::1]:4000' },
      socket: { remoteAddress: '::1' } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('noAuth=true + Host=127.0.0.1 + remoteAddress=::ffff:127.0.0.1 -> next()', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { host: '127.0.0.1' },
      socket: { remoteAddress: '::ffff:127.0.0.1' } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('noAuth=true + Host=localhost + remoteAddress=203.0.113.1 -> 403', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { host: 'localhost' },
      socket: { remoteAddress: '203.0.113.1' } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next as unknown as NextFunction);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('noAuth=true + missing Host header -> 403', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: {} as Request['headers'],
      socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next as unknown as NextFunction);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('noAuth=true + Host=localhost + missing remoteAddress -> 403', () => {
    const mw = localOnlyMiddleware(true);
    const req = mockReq({
      headers: { host: 'localhost' },
      socket: {} as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next as unknown as NextFunction);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('noAuth=false -> always next()', () => {
    const mw = localOnlyMiddleware(false);
    const req = mockReq({
      headers: { host: 'evil.com' },
      socket: { remoteAddress: '203.0.113.1' } as unknown as Request['socket'],
    });
    const res = mockRes();
    const next = vi.fn();

    mw(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
