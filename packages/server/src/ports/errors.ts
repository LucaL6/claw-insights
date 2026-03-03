// src/ports/errors.ts

/**
 * Standard Port error codes for normalized error handling across all ports.
 */
export type PortErrorCode = 'NOT_FOUND' | 'UNAVAILABLE' | 'TIMEOUT' | 'INVALID_STATE' | 'RATE_LIMITED';

/**
 * Normalized error type thrown by all Port implementations.
 * Provides consistent error handling across data sources.
 */
export interface PortError extends Error {
  code: PortErrorCode;
  retriable: boolean;
  source: string;
  cause?: unknown;
}

/**
 * Create a PortError with the given code, source, and message.
 *
 * @param code - The error code
 * @param source - The source identifier (e.g., 'session-adapter', 'metrics-adapter')
 * @param message - Error message
 * @param cause - Optional underlying error
 */
export function createPortError(code: PortErrorCode, source: string, message: string, cause?: unknown): PortError {
  const retriable = isRetriableCode(code);
  const err = new Error(`[${source}] ${message}`) as PortError;
  err.code = code;
  err.retriable = retriable;
  err.source = source;
  err.cause = cause;
  return err;
}

/**
 * Determine if a given error code should be retried.
 */
function isRetriableCode(code: PortErrorCode): boolean {
  switch (code) {
    case 'UNAVAILABLE':
    case 'TIMEOUT':
    case 'RATE_LIMITED':
      return true;
    case 'NOT_FOUND':
    case 'INVALID_STATE':
      return false;
  }
}
