import { describe, expect, it } from 'vitest';

import {
  COALESCE_WINDOW_MS,
  COLLECT_TIMEOUT_MS,
  CollectTimeoutError,
  ErrorCodes,
  GatewayUnreachableError,
  makeErrorResponse,
  MAX_OUTPUT_BYTES,
  PayloadTooLargeError,
  QUEUE_WAIT_TIMEOUT_MS,
  QueueFullError,
  QueueTimeoutError,
  RATE_LIMIT_PER_MINUTE,
  RateLimitedError,
  RENDER_CONCURRENCY,
  RENDER_QUEUE_MAX,
  RenderTimeoutError,
  TOTAL_TIMEOUT_MS,
  TotalTimeoutError,
} from '../snapshot-errors.js';

describe('Custom error classes', () => {
  it('custom errors have correct names', () => {
    expect(new CollectTimeoutError().name).toBe('CollectTimeoutError');
    expect(new RenderTimeoutError().name).toBe('RenderTimeoutError');
    expect(new TotalTimeoutError().name).toBe('TotalTimeoutError');
    expect(new QueueTimeoutError().name).toBe('QueueTimeoutError');
    expect(new PayloadTooLargeError().name).toBe('PayloadTooLargeError');
  });

  it('QueueFullError includes max in message', () => {
    expect(new QueueFullError(10).message).toContain('10');
  });

  it('RateLimitedError stores retryAfterMs', () => {
    const err = new RateLimitedError(2000);
    expect(err.retryAfterMs).toBe(2000);
    expect(err.name).toBe('RateLimitedError');
    expect(err.message).toBe('Rate limit exceeded');
  });

  it('GatewayUnreachableError has correct name', () => {
    const err = new GatewayUnreachableError();
    expect(err.name).toBe('GatewayUnreachableError');
    expect(err.message).toContain('Gateway');
  });

  it('all errors are instanceof Error', () => {
    expect(new CollectTimeoutError()).toBeInstanceOf(Error);
    expect(new RateLimitedError(100)).toBeInstanceOf(Error);
    expect(new QueueFullError(5)).toBeInstanceOf(Error);
    expect(new GatewayUnreachableError()).toBeInstanceOf(Error);
  });
});

describe('makeErrorResponse', () => {
  it('creates basic error response', () => {
    const res = makeErrorResponse('TEST', 'test error');
    expect(res).toEqual({ error: 'test error', code: 'TEST' });
  });

  it('includes optional fields', () => {
    const res = makeErrorResponse('RATE_LIMITED', 'too fast', {
      retryAfter: 5,
      suggestion: 'slow down',
    });
    expect(res.retryAfter).toBe(5);
    expect(res.suggestion).toBe('slow down');
  });
});

describe('ErrorCodes', () => {
  it('has expected codes', () => {
    expect(ErrorCodes.INVALID_PARAM).toBe('INVALID_PARAM');
    expect(ErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED');
    expect(ErrorCodes.QUEUE_FULL).toBe('QUEUE_FULL');
  });
});

describe('Constants', () => {
  it('have expected values', () => {
    expect(MAX_OUTPUT_BYTES).toBe(2 * 1024 * 1024);
    expect(TOTAL_TIMEOUT_MS).toBe(15_000);
    expect(COLLECT_TIMEOUT_MS).toBe(8_000);
    expect(QUEUE_WAIT_TIMEOUT_MS).toBe(5_000);
    expect(RATE_LIMIT_PER_MINUTE).toBe(30);
    expect(RENDER_CONCURRENCY).toBe(3);
    expect(RENDER_QUEUE_MAX).toBe(10);
    expect(COALESCE_WINDOW_MS).toBe(500);
  });
});
