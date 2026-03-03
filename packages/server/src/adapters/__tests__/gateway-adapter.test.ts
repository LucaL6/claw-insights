// src/adapters/__tests__/gateway-adapter.test.ts
import { describe, expect, it, vi } from 'vitest';

import type { GatewayStatus } from '../../ports/gateway-port.js';
import { createGatewayAdapter } from '../gateway-adapter.js';

describe('GatewayAdapter', () => {
  // Mock GatewayClient
  function createMockClient() {
    const status: GatewayStatus = {
      running: true,
      pid: 12345,
      version: '1.0.0',
      updateAvailable: null,
      uptime: '5 days',
      startedAt: '2026-03-01T00:00:00.000Z',
      channels: [],
      connectLatencyMs: 50,
      latestVersion: '1.0.0',
      securitySummary: { critical: 0, warn: 0, info: 0 },
      sessionDefaults: { model: 'claude-4', contextTokens: 200000 },
    };

    return {
      getGatewayStatus: vi.fn(async () => status),
      getVersion: vi.fn(async () => '1.0.0'),
      warmCache: vi.fn(async () => {}),
      _status: status,
    };
  }

  describe('basic port contract', () => {
    it('should return gateway status from client', async () => {
      const client = createMockClient();
      const adapter = createGatewayAdapter(client as any);

      const result = await adapter.getGatewayStatus();

      expect(result).toEqual(client._status);
      expect(client.getGatewayStatus).toHaveBeenCalledOnce();
    });

    it('should return version from client', async () => {
      const client = createMockClient();
      const adapter = createGatewayAdapter(client as any);

      const result = await adapter.getVersion();

      expect(result).toBe('1.0.0');
      expect(client.getVersion).toHaveBeenCalledOnce();
    });

    it('should warm cache', async () => {
      const client = createMockClient();
      const adapter = createGatewayAdapter(client as any);

      await adapter.warmCache();

      expect(client.warmCache).toHaveBeenCalledOnce();
    });
  });

  describe('error mapping', () => {
    it('should map ECONNREFUSED to UNAVAILABLE', async () => {
      const client = {
        getGatewayStatus: vi.fn(async () => {
          const err = new Error('Connection refused') as Error & { code: string };
          err.code = 'ECONNREFUSED';
          throw err;
        }),
        getVersion: vi.fn(),
        warmCache: vi.fn(),
      };

      const adapter = createGatewayAdapter(client as any);

      await expect(adapter.getGatewayStatus()).rejects.toThrow();

      try {
        await adapter.getGatewayStatus();
      } catch (err: any) {
        expect(err.code).toBe('UNAVAILABLE');
        expect(err.source).toBe('gateway-adapter');
        expect(err.retriable).toBe(true);
      }
    });

    it('should map HTTP 503 to UNAVAILABLE', async () => {
      const client = {
        getGatewayStatus: vi.fn(async () => {
          const err = new Error('Service Unavailable') as Error & { status: number };
          err.status = 503;
          throw err;
        }),
        getVersion: vi.fn(),
        warmCache: vi.fn(),
      };

      const adapter = createGatewayAdapter(client as any);

      await expect(adapter.getGatewayStatus()).rejects.toThrow();

      try {
        await adapter.getGatewayStatus();
      } catch (err: any) {
        expect(err.code).toBe('UNAVAILABLE');
        expect(err.source).toBe('gateway-adapter');
      }
    });

    it('should map timeout errors to TIMEOUT', async () => {
      const client = {
        getGatewayStatus: vi.fn(async () => {
          const err = new Error('Request timeout') as Error & { code: string };
          err.code = 'ETIMEDOUT';
          throw err;
        }),
        getVersion: vi.fn(),
        warmCache: vi.fn(),
      };

      const adapter = createGatewayAdapter(client as any);

      await expect(adapter.getGatewayStatus()).rejects.toThrow();

      try {
        await adapter.getGatewayStatus();
      } catch (err: any) {
        expect(err.code).toBe('TIMEOUT');
        expect(err.source).toBe('gateway-adapter');
      }
    });
  });

  describe('destroy behavior', () => {
    it('should be safe to destroy', () => {
      const client = createMockClient();
      const adapter = createGatewayAdapter(client as any);

      expect(() => adapter.destroy()).not.toThrow();
    });

    it('should be idempotent on destroy', () => {
      const client = createMockClient();
      const adapter = createGatewayAdapter(client as any);

      adapter.destroy();
      adapter.destroy();
      adapter.destroy();

      // Should not throw
    });
  });
});
