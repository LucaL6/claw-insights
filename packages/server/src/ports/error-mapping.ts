// src/ports/error-mapping.ts
import { createPortError, type PortError } from './errors.js';

/**
 * Map infrastructure errors to normalized PortError.
 * Handles various error types: Node.js errno codes, HTTP status codes, database errors, etc.
 *
 * @param err - The error to map (can be Error, string, or any unknown value)
 * @param source - Source identifier for the error
 * @returns Normalized PortError
 */
export function mapInfraError(err: unknown, source: string): PortError {
  // Handle null/undefined
  if (err == null) {
    return createPortError('UNAVAILABLE', source, 'Unknown error (null/undefined)', err);
  }

  // Handle Error objects
  if (err instanceof Error) {
    const errWithCode = err as Error & { code?: string; status?: number };
    const message = err.message || 'Unknown error';

    // Check errno / structured codes
    if (errWithCode.code) {
      switch (errWithCode.code) {
        case 'ENOENT':
          return createPortError('NOT_FOUND', source, message, err);
        case 'ETIMEDOUT':
          return createPortError('TIMEOUT', source, message, err);
        case 'ECONNREFUSED':
        case 'ECONNRESET':
          return createPortError('UNAVAILABLE', source, message, err);
        case 'SQLITE_BUSY':
          return createPortError('TIMEOUT', source, message, err);
        case 'INVALID_STATE':
        case 'ERR_INVALID_STATE':
          return createPortError('INVALID_STATE', source, message, err);
      }
    }

    // Check HTTP status codes
    if (errWithCode.status) {
      switch (errWithCode.status) {
        case 404:
          return createPortError('NOT_FOUND', source, message, err);
        case 409:
          return createPortError('INVALID_STATE', source, message, err);
        case 429:
          return createPortError('RATE_LIMITED', source, message, err);
        case 503:
          return createPortError('UNAVAILABLE', source, message, err);
        case 504:
          return createPortError('TIMEOUT', source, message, err);
      }
    }

    // Default to UNAVAILABLE for unknown errors
    return createPortError('UNAVAILABLE', source, message, err);
  }

  // Handle string errors
  if (typeof err === 'string') {
    return createPortError('UNAVAILABLE', source, err, err);
  }

  // Handle other unknown types
  return createPortError('UNAVAILABLE', source, 'Unknown error type', err);
}
