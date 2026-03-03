// src/ports/__tests__/error-mapping.test.ts
import { describe, expect, it } from 'vitest';

import { mapInfraError } from '../error-mapping.js';

describe('Error Mapping', () => {
  describe('mapInfraError', () => {
    it('should map ENOENT to NOT_FOUND', () => {
      const err = new Error('File not found');
      (err as any).code = 'ENOENT';

      const portErr = mapInfraError(err, 'test-source');

      expect(portErr.code).toBe('NOT_FOUND');
      expect(portErr.source).toBe('test-source');
      expect(portErr.retriable).toBe(false);
      expect(portErr.cause).toBe(err);
    });

    it('should map 404 status to NOT_FOUND', () => {
      const err = new Error('Not found');
      (err as any).status = 404;

      const portErr = mapInfraError(err, 'http-source');

      expect(portErr.code).toBe('NOT_FOUND');
      expect(portErr.source).toBe('http-source');
      expect(portErr.retriable).toBe(false);
    });

    it('should map ETIMEDOUT to TIMEOUT', () => {
      const err = new Error('Connection timeout');
      (err as any).code = 'ETIMEDOUT';

      const portErr = mapInfraError(err, 'network-source');

      expect(portErr.code).toBe('TIMEOUT');
      expect(portErr.source).toBe('network-source');
      expect(portErr.retriable).toBe(true);
    });

    it('should map ECONNREFUSED to UNAVAILABLE', () => {
      const err = new Error('Connection refused');
      (err as any).code = 'ECONNREFUSED';

      const portErr = mapInfraError(err, 'service-source');

      expect(portErr.code).toBe('UNAVAILABLE');
      expect(portErr.source).toBe('service-source');
      expect(portErr.retriable).toBe(true);
    });

    it('should map 503 status to UNAVAILABLE', () => {
      const err = new Error('Service unavailable');
      (err as any).status = 503;

      const portErr = mapInfraError(err, 'api-source');

      expect(portErr.code).toBe('UNAVAILABLE');
      expect(portErr.source).toBe('api-source');
      expect(portErr.retriable).toBe(true);
    });

    it('should map 429 status to RATE_LIMITED', () => {
      const err = new Error('Too many requests');
      (err as any).status = 429;

      const portErr = mapInfraError(err, 'rate-limited-source');

      expect(portErr.code).toBe('RATE_LIMITED');
      expect(portErr.source).toBe('rate-limited-source');
      expect(portErr.retriable).toBe(true);
    });

    it('should map explicit INVALID_STATE code to INVALID_STATE', () => {
      const err = new Error('Invalid state') as Error & { code: string };
      err.code = 'ERR_INVALID_STATE';

      const portErr = mapInfraError(err, 'state-source');

      expect(portErr.code).toBe('INVALID_STATE');
      expect(portErr.source).toBe('state-source');
      expect(portErr.retriable).toBe(false);
    });

    it('should NOT map generic invalid message to INVALID_STATE without structured code/status', () => {
      const err = new Error('Invalid JSON payload');

      const portErr = mapInfraError(err, 'message-source');

      expect(portErr.code).toBe('UNAVAILABLE');
      expect(portErr.source).toBe('message-source');
    });

    it('should handle unknown errors gracefully', () => {
      const err = new Error('Unknown error');

      const portErr = mapInfraError(err, 'unknown-source');

      expect(portErr.code).toBeDefined();
      expect(['NOT_FOUND', 'UNAVAILABLE', 'TIMEOUT', 'INVALID_STATE', 'RATE_LIMITED']).toContain(portErr.code);
      expect(portErr.source).toBe('unknown-source');
      expect(portErr.cause).toBe(err);
    });

    it('should handle non-Error objects', () => {
      const err = 'string error';

      const portErr = mapInfraError(err, 'string-source');

      expect(portErr.code).toBeDefined();
      expect(portErr.source).toBe('string-source');
      expect(portErr.cause).toBe(err);
    });

    it('should handle null/undefined errors', () => {
      const portErr1 = mapInfraError(null, 'null-source');
      const portErr2 = mapInfraError(undefined, 'undefined-source');

      expect(portErr1.code).toBeDefined();
      expect(portErr1.source).toBe('null-source');

      expect(portErr2.code).toBeDefined();
      expect(portErr2.source).toBe('undefined-source');
    });

    it('should preserve error message in PortError', () => {
      const err = new Error('Custom error message');
      (err as any).code = 'ENOENT';

      const portErr = mapInfraError(err, 'message-source');

      expect(portErr.message).toContain('Custom error message');
      expect(portErr.message).toContain('message-source');
    });

    it('should handle database lock timeout', () => {
      const err = new Error('database is locked');
      (err as any).code = 'SQLITE_BUSY';

      const portErr = mapInfraError(err, 'db-source');

      expect(portErr.code).toBe('TIMEOUT');
      expect(portErr.retriable).toBe(true);
    });

    it('should handle ECONNRESET as UNAVAILABLE', () => {
      const err = new Error('Connection reset');
      (err as any).code = 'ECONNRESET';

      const portErr = mapInfraError(err, 'connection-source');

      expect(portErr.code).toBe('UNAVAILABLE');
      expect(portErr.retriable).toBe(true);
    });
  });
});
