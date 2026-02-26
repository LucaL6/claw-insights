export class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly msPerToken: number;

  constructor(
    private readonly maxTokens: number,
    private readonly refillIntervalMs: number,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.msPerToken = refillIntervalMs / maxTokens;
  }

  tryConsume(): { allowed: boolean; retryAfterMs: number } {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return { allowed: true, retryAfterMs: 0 };
    }
    const nextTokenAt = this.lastRefill + this.msPerToken;
    const retryAfterMs = Math.max(1, Math.ceil(nextTokenAt - Date.now()));
    return { allowed: false, retryAfterMs };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.msPerToken);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      // Advance lastRefill by exact consumed time (no precision loss)
      this.lastRefill += tokensToAdd * this.msPerToken;
    }
  }
}
