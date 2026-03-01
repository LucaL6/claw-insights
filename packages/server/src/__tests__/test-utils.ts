import type { NextFunction, Request, Response } from 'express';
import { vi } from 'vitest';

/**
 * Typed Express mock factories for test files.
 * Avoids `as any` while keeping mocks type-compatible.
 */

export function createMockResponse(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis() as unknown as Response['status'],
    json: vi.fn().mockReturnThis() as unknown as Response['json'],
    send: vi.fn().mockReturnThis() as unknown as Response['send'],
    cookie: vi.fn() as unknown as Response['cookie'],
    clearCookie: vi.fn() as unknown as Response['clearCookie'],
    set: vi.fn().mockReturnThis() as unknown as Response['set'],
    header: vi.fn().mockReturnThis() as unknown as Response['header'],
    sendStatus: vi.fn().mockReturnThis() as unknown as Response['sendStatus'],
    redirect: vi.fn().mockReturnThis() as unknown as Response['redirect'],
  };
  return res as Response;
}

export function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

export function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    query: {},
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}
