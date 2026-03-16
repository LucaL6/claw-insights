import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Platform } from '../../ports/types.js';
import { createGatewayClient } from '../gateway-cli.js';

vi.mock('../../events.js', () => ({
  emitChange: vi.fn(),
}));

import { emitChange } from '../../events.js';

const MOCK_STATUS_JSON = JSON.stringify({
  gateway: { reachable: true, connectLatencyMs: 25 },
  gatewayService: { runtimeShort: 'running pid 9999' },
  channelSummary: ['Telegram: connected', 'Discord: connected'],
  update: { latestVersion: '3.0.0' },
  securityAudit: { summary: { critical: 0, warn: 1, info: 5 } },
  sessions: { defaults: { model: 'opus', contextTokens: 200000 } },
});

function mockPlatform(overrides?: Partial<{ cliExec: (args: string[]) => Promise<string> }>): Platform {
  const cliExec =
    overrides?.cliExec ??
    vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve('2.5.0\n');
    });

  return {
    cli: { exec: cliExec as Platform['cli']['exec'] },
    process: {
      findPidByPort: vi.fn(() => Promise.resolve(null)),
      getUptime: vi.fn(() => Promise.resolve('5m 30s')),
      getPid: vi.fn(() => Promise.resolve(9999)),
      getProcessMetrics: vi.fn(() => Promise.resolve({ cpu: 1, memoryMB: 100 })),
      getDiskMB: vi.fn(() => Promise.resolve(500)),
    },
  } as unknown as Platform;
}

describe('gateway-cli extended fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include connectLatencyMs in gateway status', async () => {
    const client = createGatewayClient(mockPlatform());
    const status = await client.getGatewayStatus();
    expect(status.connectLatencyMs).toBe(25);
  });

  it('should include latestVersion in gateway status', async () => {
    const client = createGatewayClient(mockPlatform());
    const status = await client.getGatewayStatus();
    expect(status.latestVersion).toBe('3.0.0');
  });

  it('should include securitySummary in gateway status', async () => {
    const client = createGatewayClient(mockPlatform());
    const status = await client.getGatewayStatus();
    expect(status.securitySummary).toEqual({ critical: 0, warn: 1, info: 5 });
  });

  it('should include sessionDefaults in gateway status', async () => {
    const client = createGatewayClient(mockPlatform());
    const status = await client.getGatewayStatus();
    expect(status.sessionDefaults).toEqual({ model: 'opus', contextTokens: 200000 });
  });

  it('deduplicates concurrent calls (in-flight guard)', async () => {
    let callCount = 0;
    const cliExec = vi.fn((args: string[]) => {
      callCount++;
      return new Promise<string>((resolve) => {
        setTimeout(() => {
          if (args.some((a: string) => a.includes('--json'))) {
            resolve(MOCK_STATUS_JSON);
          } else {
            resolve('2.5.0\n');
          }
        }, 50);
      });
    });

    const client = createGatewayClient(mockPlatform({ cliExec }));
    const [a, b] = await Promise.all([client.getGatewayStatus(), client.getGatewayStatus()]);

    expect(a.running).toBe(true);
    expect(b.running).toBe(true);
    expect(a).toBe(b);
    // With dedup: 2 calls (status --json + --version), not 4
    expect(callCount).toBeLessThanOrEqual(2);
  });
});

const MOCK_FAIL_STATUS_JSON = JSON.stringify({
  gateway: { reachable: false },
  gatewayService: { runtimeShort: 'stopped' },
  channelSummary: [],
});

describe('cache TTL behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches successful status for 10s', async () => {
    const cliExec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve('2.5.0\n');
    });
    const client = createGatewayClient(mockPlatform({ cliExec }));

    await client.getGatewayStatus();
    expect(cliExec).toHaveBeenCalledTimes(2); // status + version

    // At 9s — still cached
    vi.advanceTimersByTime(9_000);
    await client.getGatewayStatus();
    expect(cliExec).toHaveBeenCalledTimes(2);

    // At 10s+ — expired (version still cached at 60s TTL, so only status re-fetched)
    vi.advanceTimersByTime(2_000);
    await client.getGatewayStatus();
    expect(cliExec).toHaveBeenCalledTimes(3); // re-fetched status only
  });

  it('caches failed status for 3s', async () => {
    const cliExec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(MOCK_FAIL_STATUS_JSON);
      }
      return Promise.resolve('2.5.0\n');
    });
    const client = createGatewayClient(mockPlatform({ cliExec }));

    await client.getGatewayStatus();
    expect(cliExec).toHaveBeenCalledTimes(2);

    // At 2s — still cached
    vi.advanceTimersByTime(2_000);
    await client.getGatewayStatus();
    expect(cliExec).toHaveBeenCalledTimes(2);

    // At 3s+ — expired (version still cached)
    vi.advanceTimersByTime(2_000);
    await client.getGatewayStatus();
    expect(cliExec).toHaveBeenCalledTimes(3);
  });

  it('does not emit change when status is unchanged', async () => {
    const cliExec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve('2.5.0\n');
    });
    const client = createGatewayClient(mockPlatform({ cliExec }));

    await client.getGatewayStatus();
    expect(emitChange).toHaveBeenCalledTimes(1);

    // Expire cache and re-fetch same status
    vi.advanceTimersByTime(11_000);
    await client.getGatewayStatus();
    // Should NOT emit again since status is identical
    expect(emitChange).toHaveBeenCalledTimes(1);
  });

  it('returns stale status on empty stdout within 30s and uses short retry TTL', async () => {
    let statusCall = 0;
    const cliExec = vi.fn((args: string[]) => {
      if (!args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve('2.5.0\n');
      }
      statusCall += 1;
      if (statusCall === 1) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      if (statusCall === 2) {
        return Promise.resolve('');
      }
      return Promise.resolve(MOCK_STATUS_JSON);
    });

    const client = createGatewayClient(mockPlatform({ cliExec }));
    const first = await client.getGatewayStatus();
    vi.advanceTimersByTime(11_000);
    const stale = await client.getGatewayStatus();
    expect(stale.running).toBe(first.running);
    expect(stale.pid).toBe(first.pid);

    vi.advanceTimersByTime(3_100);
    await client.getGatewayStatus();
    expect(statusCall).toBe(3);
  });

  it('returns stale status on malformed JSON within 30s without extra emit when unchanged', async () => {
    let statusCall = 0;
    const cliExec = vi.fn((args: string[]) => {
      if (!args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve('2.5.0\n');
      }
      statusCall += 1;
      if (statusCall === 1) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve('{bad json');
    });

    const client = createGatewayClient(mockPlatform({ cliExec }));
    const first = await client.getGatewayStatus();
    expect(emitChange).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(11_000);
    const stale = await client.getGatewayStatus();
    expect(stale.running).toBe(first.running);
    expect(stale.pid).toBe(first.pid);
    expect(emitChange).toHaveBeenCalledTimes(1);
  });

  it('returns stale status when JSON is valid but structurally invalid within 30s', async () => {
    const structurallyInvalidJson = JSON.stringify({
      gateway: { reachable: true },
      gatewayService: { runtimeShort: 'running pid 9999' },
      channelSummary: {},
      update: { latestVersion: '3.0.0' },
    });

    let statusCall = 0;
    const cliExec = vi.fn((args: string[]) => {
      if (!args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve('2.5.0\n');
      }
      statusCall += 1;
      if (statusCall === 1) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve(structurallyInvalidJson);
    });

    const client = createGatewayClient(mockPlatform({ cliExec }));
    const first = await client.getGatewayStatus();

    vi.advanceTimersByTime(11_000);
    const stale = await client.getGatewayStatus();
    expect(stale.running).toBe(first.running);
    expect(stale.pid).toBe(first.pid);
  });
});
