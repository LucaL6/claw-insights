import { afterEach, describe, expect, it, vi } from 'vitest';

import { TokenBucketLimiter } from '../rate-limiter.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('TokenBucketLimiter', () => {
  it('allows requests within limit', () => {
    const limiter = new TokenBucketLimiter(5, 60_000);
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume().allowed).toBe(true);
    }
  });

  it('rejects when bucket empty', () => {
    const limiter = new TokenBucketLimiter(2, 60_000);
    limiter.tryConsume();
    limiter.tryConsume();
    const result = limiter.tryConsume();
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('refills correctly over time without precision loss', () => {
    vi.useFakeTimers();
    const limiter = new TokenBucketLimiter(4, 40_000); // 1 token per 10s
    for (let i = 0; i < 4; i++) {
      limiter.tryConsume();
    }
    expect(limiter.tryConsume().allowed).toBe(false);

    // Advance 25s → should refill 2 tokens (floor of 25/10)
    vi.advanceTimersByTime(25_000);
    expect(limiter.tryConsume().allowed).toBe(true);
    expect(limiter.tryConsume().allowed).toBe(true);
    expect(limiter.tryConsume().allowed).toBe(false);

    // Advance another 5s → remaining 5s from before + 5s = 10s → 1 token
    vi.advanceTimersByTime(5_000);
    expect(limiter.tryConsume().allowed).toBe(true);
    expect(limiter.tryConsume().allowed).toBe(false);
  });

  it('retryAfterMs is approximately one token interval', () => {
    const limiter = new TokenBucketLimiter(2, 60_000); // 30s per token
    limiter.tryConsume();
    limiter.tryConsume();
    const result = limiter.tryConsume();
    expect(result.retryAfterMs).toBeGreaterThanOrEqual(29_000);
    expect(result.retryAfterMs).toBeLessThanOrEqual(31_000);
  });

  it('does not exceed maxTokens on refill', () => {
    vi.useFakeTimers();
    const limiter = new TokenBucketLimiter(3, 30_000);
    // Don't consume any, advance a lot of time
    vi.advanceTimersByTime(120_000);
    // Should still only have 3 tokens
    expect(limiter.tryConsume().allowed).toBe(true);
    expect(limiter.tryConsume().allowed).toBe(true);
    expect(limiter.tryConsume().allowed).toBe(true);
    expect(limiter.tryConsume().allowed).toBe(false);
  });
});
