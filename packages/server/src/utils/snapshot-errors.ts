// ── Error Response Type ──
export interface SnapshotErrorResponse {
  error: string;
  code: string;
  retryAfter?: number;
  suggestion?: string;
}

export function makeErrorResponse(
  code: string,
  error: string,
  opts?: { retryAfter?: number; suggestion?: string },
): SnapshotErrorResponse {
  return { error, code, ...opts };
}

// ── Custom Error Classes (no string matching) ──
export class CollectTimeoutError extends Error {
  constructor() {
    super('Data collection timed out');
    this.name = 'CollectTimeoutError';
  }
}

export class RenderTimeoutError extends Error {
  constructor() {
    super('Snapshot rendering timed out');
    this.name = 'RenderTimeoutError';
  }
}

export class TotalTimeoutError extends Error {
  constructor() {
    super('Total snapshot timeout exceeded');
    this.name = 'TotalTimeoutError';
  }
}

export class QueueFullError extends Error {
  constructor(max: number) {
    super(`Render queue is full (max ${max})`);
    this.name = 'QueueFullError';
  }
}

export class QueueTimeoutError extends Error {
  constructor() {
    super('Queue wait timed out');
    this.name = 'QueueTimeoutError';
  }
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Snapshot output exceeds size limit');
    this.name = 'PayloadTooLargeError';
  }
}

export class GatewayUnreachableError extends Error {
  constructor() {
    super('OpenClaw Gateway is not reachable');
    this.name = 'GatewayUnreachableError';
  }
}

export class RateLimitedError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitedError';
    this.retryAfterMs = retryAfterMs;
  }
}

// ── Error Codes ──
export const ErrorCodes = {
  INVALID_PARAM: 'INVALID_PARAM',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  RENDER_FAILED: 'RENDER_FAILED',
  GATEWAY_UNREACHABLE: 'GATEWAY_UNREACHABLE',
  QUEUE_FULL: 'QUEUE_FULL',
  QUEUE_TIMEOUT: 'QUEUE_TIMEOUT',
  COLLECT_TIMEOUT: 'COLLECT_TIMEOUT',
  TOTAL_TIMEOUT: 'TOTAL_TIMEOUT',
} as const;

// ── Constants ──
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // 2MB
export const TOTAL_TIMEOUT_MS = 15_000; // 15s hard budget
export const COLLECT_TIMEOUT_MS = 8_000; // max 8s for data collection
export const QUEUE_WAIT_TIMEOUT_MS = 5_000; // max 5s waiting in queue
export const RATE_LIMIT_PER_MINUTE = 30;
export const RENDER_CONCURRENCY = 3;
export const RENDER_QUEUE_MAX = 10;
export const COALESCE_WINDOW_MS = 500; // in-flight coalescing window (REQ-019 §4.4)
