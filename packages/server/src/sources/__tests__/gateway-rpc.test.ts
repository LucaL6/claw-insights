import { describe, it, expect } from 'bun:test';
import { GatewayRPC, READ_ONLY_METHODS } from '../gateway-rpc';

describe('GatewayRPC', () => {
  it('should enforce read-only allowlist', async () => {
    const rpc = new GatewayRPC('ws://127.0.0.1:1');
    await expect(rpc.call('gateway.restart')).rejects.toThrow('Method not allowed');
    rpc.close();
  });

  it('should include expected allowlisted methods', () => {
    expect(READ_ONLY_METHODS.has('health')).toBe(true);
    expect(READ_ONLY_METHODS.has('status')).toBe(true);
    expect(READ_ONLY_METHODS.has('channels.status')).toBe(true);
    expect(READ_ONLY_METHODS.has('sessions.list')).toBe(true);
  });

  it('should reject call when not connected', async () => {
    const rpc = new GatewayRPC('ws://127.0.0.1:1'); // unreachable, never connected
    await expect(rpc.call('health')).rejects.toThrow('not connected');
    rpc.close();
  });

  it('should reject non-allowlisted methods', async () => {
    const rpc = new GatewayRPC();
    await expect(rpc.call('sessions.delete')).rejects.toThrow('Method not allowed');
    await expect(rpc.call('config.apply')).rejects.toThrow('Method not allowed');
    await expect(rpc.call('gateway.restart')).rejects.toThrow('Method not allowed');
    rpc.close();
  });

  it('should accept all allowlisted methods without throwing allowlist error', async () => {
    const rpc = new GatewayRPC('ws://127.0.0.1:1');
    for (const method of ['sessions.list', 'health', 'status', 'channels.status']) {
      const err = await rpc.call(method).catch((e: Error) => e);
      expect((err as Error).message).not.toContain('not allowed');
    }
    rpc.close();
  });
});
