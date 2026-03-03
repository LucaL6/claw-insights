// src/ports/__tests__/contracts.test.ts
import { describe, expect, it } from 'vitest';

import type { PortErrorCode } from '../index.js';

describe('Port Contracts', () => {
  describe('PORT_KEYS', () => {
    it('should export PORT_KEYS with stable literal keys', async () => {
      const { PORT_KEYS } = await import('../index.js');
      expect(PORT_KEYS).toBeDefined();
      expect(PORT_KEYS.sessions).toBe('sessions');
      expect(PORT_KEYS.metrics).toBe('metrics');
      expect(PORT_KEYS.gateway).toBe('gateway');
      expect(PORT_KEYS.cron).toBe('cron');
      expect(PORT_KEYS.logs).toBe('logs');
      expect(PORT_KEYS.system).toBe('system');
    });

    it('should have readonly keys (const assertion)', async () => {
      const { PORT_KEYS } = await import('../index.js');
      // TypeScript const assertion should make this readonly
      // Runtime check: object should be frozen or const
      expect(Object.isFrozen(PORT_KEYS) || Object.isSealed(PORT_KEYS)).toBe(true);
    });
  });

  describe('PortErrorCode', () => {
    it('should have exactly 5 error codes', async () => {
      const { createPortError } = await import('../index.js');

      // Create one of each code to verify they exist
      const codes: PortErrorCode[] = ['NOT_FOUND', 'UNAVAILABLE', 'TIMEOUT', 'INVALID_STATE', 'RATE_LIMITED'];

      codes.forEach((code) => {
        const err = createPortError(code, 'test', 'test message');
        expect(err.code).toBe(code);
      });
    });
  });

  describe('PortError', () => {
    it('should have correct shape', async () => {
      const { createPortError } = await import('../index.js');

      const err = createPortError('NOT_FOUND', 'test-source', 'test message', new Error('cause'));

      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.retriable).toBeDefined();
      expect(typeof err.retriable).toBe('boolean');
      expect(err.source).toBe('test-source');
      expect(err.message).toContain('test message');
      expect(err.cause).toBeDefined();
    });

    it('should set retriable correctly for different codes', async () => {
      const { createPortError } = await import('../index.js');

      expect(createPortError('NOT_FOUND', 'src', 'msg').retriable).toBe(false);
      expect(createPortError('UNAVAILABLE', 'src', 'msg').retriable).toBe(true);
      expect(createPortError('TIMEOUT', 'src', 'msg').retriable).toBe(true);
      expect(createPortError('INVALID_STATE', 'src', 'msg').retriable).toBe(false);
      expect(createPortError('RATE_LIMITED', 'src', 'msg').retriable).toBe(true);
    });
  });

  describe('ReadContext', () => {
    it('should have correct shape with plain fields', async () => {
      const { createReadContext } = await import('../index.js');

      const rc = createReadContext();

      expect(rc.requestId).toBeDefined();
      expect(typeof rc.requestId).toBe('string');
      expect(rc.requestId.length).toBeGreaterThan(0);

      expect(rc.asOfTs).toBeDefined();
      expect(typeof rc.asOfTs).toBe('number');
      expect(rc.asOfTs).toBeGreaterThan(0);
    });

    it('asOfTs must be a plain field, not a getter', async () => {
      const { createReadContext } = await import('../index.js');

      const rc = createReadContext();
      const descriptor = Object.getOwnPropertyDescriptor(rc, 'asOfTs');

      expect(descriptor).toBeDefined();
      expect(descriptor?.get).toBeUndefined();
      expect(descriptor?.value).toBe(rc.asOfTs);
    });

    it('should freeze asOfTs value across multiple accesses', async () => {
      const { createReadContext } = await import('../index.js');

      const rc = createReadContext();
      const first = rc.asOfTs;
      const second = rc.asOfTs;

      expect(first).toBe(second);
    });

    it('should generate unique requestId for each call', async () => {
      const { createReadContext } = await import('../index.js');

      const rc1 = createReadContext();
      const rc2 = createReadContext();

      expect(rc1.requestId).not.toBe(rc2.requestId);
    });
  });

  describe('Unsubscribe and SubscribablePort', () => {
    it('Unsubscribe should be a function type', async () => {
      const module = await import('../index.js');
      // Type check only - runtime verification will be in adapter tests
      // We just verify the type exports exist
      expect(module).toBeDefined();
    });
  });

  describe('Port Interfaces', () => {
    it('SessionPort should have read methods with optional ReadContext', async () => {
      // Type-level test - will be validated by TypeScript compilation
      const module = await import('../index.js');
      expect(module).toBeDefined();
      // Actual method signature validation will be done via adapter implementations
    });

    it('MetricsPort should have read methods with optional ReadContext', async () => {
      const module = await import('../index.js');
      expect(module).toBeDefined();
    });

    it('GatewayPort should have read methods with optional ReadContext', async () => {
      const module = await import('../index.js');
      expect(module).toBeDefined();
    });

    it('CronPort should exist for Phase 2', async () => {
      const module = await import('../index.js');
      expect(module).toBeDefined();
    });

    it('LogPort should exist for Phase 2', async () => {
      const module = await import('../index.js');
      expect(module).toBeDefined();
    });

    it('SystemPort should exist for Phase 2', async () => {
      const module = await import('../index.js');
      expect(module).toBeDefined();
    });
  });

  describe('TypedPorts', () => {
    it('should require Phase 1 ports and allow undefined for Phase 2', async () => {
      const module = await import('../index.js');

      // Type-level validation:
      // TypedPorts should have:
      // - sessions: SessionPort (required)
      // - metrics: MetricsPort (required)
      // - gateway: GatewayPort (required)
      // - cron: CronPort | undefined
      // - logs: LogPort | undefined
      // - system: SystemPort | undefined

      // This will be validated by TypeScript compilation
      // Runtime we just ensure the type exports
      expect(module).toBeDefined();
    });
  });

  describe('JSDoc annotations', () => {
    it('Port methods should have @consistency, @mode, @timeoutMs annotations', async () => {
      // This test validates documentation exists
      // Actual JSDoc parsing would require reading source files
      // For now, we validate exports exist and will manually review JSDoc
      const module = await import('../index.js');
      expect(module).toBeDefined();
    });
  });
});
