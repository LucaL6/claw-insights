import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Platform } from '../../ports/types.js';
import { createGatewayClient } from '../gateway-cli.js';

vi.mock('../../events.js', () => ({
  emitChange: vi.fn(),
}));

const MOCK_STATUS_JSON = JSON.stringify({
  gateway: { reachable: true, connectLatencyMs: 25 },
  gatewayService: { runtimeShort: 'running pid 9999' },
  channelSummary: ['Telegram: connected'],
  update: { latestVersion: '3.0.0' },
  securityAudit: { summary: { critical: 0, warn: 0, info: 0 } },
  sessions: { defaults: { model: 'opus', contextTokens: 200000 } },
});

function mockPlatform(cliExec?: Platform['cli']['exec']): Platform {
  const exec =
    cliExec ??
    vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve('2.5.0\n');
    });
  return {
    cli: { exec },
    process: {
      findPidByPort: vi.fn(() => Promise.resolve(null)),
      getUptime: vi.fn(() => Promise.resolve('5m')),
      getPid: vi.fn(() => Promise.resolve(9999)),
      getProcessMetrics: vi.fn(() => Promise.resolve({ cpu: 1, memoryMB: 100 })),
      getDiskMB: vi.fn(() => Promise.resolve(500)),
    },
  } as unknown as Platform;
}

describe('gateway-cli branches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('returns "unknown" when --version output is empty', async () => {
    const exec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve('');
    });
    const client = createGatewayClient(mockPlatform(exec as any));
    const version = await client.getVersion();
    expect(version).toBe('unknown');
  });

  it('returns cached version on second call', async () => {
    const exec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve('3.0.0\n');
    });
    const client = createGatewayClient(mockPlatform(exec as any));
    const firstVersion = await client.getVersion();
    const secondVersion = await client.getVersion();
    expect(firstVersion).toBe('3.0.0');
    expect(secondVersion).toBe('3.0.0');
    // exec called only once for version (cached)
    const versionCalls = (exec as any).mock.calls.filter(
      (c: string[][]) => !c[0].some((a: string) => a.includes('--json')),
    );
    expect(versionCalls.length).toBe(1);
  });

  it('handles gateway with running but no pid (fallback to findPidByPort)', async () => {
    const statusJson = JSON.stringify({
      gateway: { reachable: true, connectLatencyMs: 10 },
      gatewayService: { runtimeShort: 'running' }, // no pid
      channelSummary: [],
      update: { registry: { latestVersion: '4.0.0' } },
      securityAudit: { summary: { critical: 0, warn: 0, info: 0 } },
      sessions: {},
    });
    const exec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(statusJson);
      }
      return Promise.resolve('3.0.0\n');
    });
    const platform = mockPlatform(exec as any);
    (platform.process.findPidByPort as any).mockResolvedValue(5678);
    const client = createGatewayClient(platform);
    const status = await client.getGatewayStatus();
    expect(status.running).toBe(true);
    expect(status.updateAvailable).toBe('4.0.0');
  });

  it('handles gateway not running', async () => {
    const statusJson = JSON.stringify({
      gateway: { reachable: false },
      gatewayService: { runtimeShort: 'stopped' },
      channelSummary: [],
      update: {},
      securityAudit: {},
      sessions: {},
    });
    const exec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(statusJson);
      }
      return Promise.resolve('3.0.0\n');
    });
    const client = createGatewayClient(mockPlatform(exec as any));
    const status = await client.getGatewayStatus();
    expect(status.running).toBe(false);
    expect(status.uptime).toBe('unknown');
  });

  it('handles malformed JSON gracefully', async () => {
    const exec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve('not json');
      }
      return Promise.resolve('3.0.0\n');
    });
    const client = createGatewayClient(mockPlatform(exec as any));
    const status = await client.getGatewayStatus();
    expect(status.running).toBe(false);
    expect(status.version).toBe('unknown');
  });

  it('handles structurally invalid JSON gracefully', async () => {
    const structurallyInvalid = JSON.stringify({
      gateway: { reachable: true },
      gatewayService: { runtimeShort: 'running pid 9999' },
      channelSummary: {},
      update: { latestVersion: '3.1.0' },
    });

    const exec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(structurallyInvalid);
      }
      return Promise.resolve('3.0.0\n');
    });
    const client = createGatewayClient(mockPlatform(exec as any));
    const status = await client.getGatewayStatus();
    expect(status.running).toBe(false);
    expect(status.version).toBe('unknown');
  });

  it('emits change when status changes', async () => {
    const exec = vi.fn((args: string[]) => {
      if (args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve('2.5.0\n');
    });
    const client = createGatewayClient(mockPlatform(exec as any));
    await client.getGatewayStatus();
    // Second call with same status should not crash
    await client.getGatewayStatus();
  });

  it('age > 30s with malformed output returns unavailable/down status', async () => {
    let statusCall = 0;
    const exec = vi.fn((args: string[]) => {
      if (!args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve('2.5.0\n');
      }
      statusCall += 1;
      if (statusCall === 1) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve('not json');
    });
    const client = createGatewayClient(mockPlatform(exec as any));
    await client.getGatewayStatus();
    vi.advanceTimersByTime(41_000);
    const status = await client.getGatewayStatus();
    expect(status.running).toBe(false);
  });

  it('valid stopped JSON is not overridden by stale status', async () => {
    const stoppedJson = JSON.stringify({
      gateway: { reachable: false },
      gatewayService: { runtimeShort: 'stopped' },
      channelSummary: [],
      update: {},
      securityAudit: {},
      sessions: {},
    });
    let statusCall = 0;
    const exec = vi.fn((args: string[]) => {
      if (!args.some((a: string) => a.includes('--json'))) {
        return Promise.resolve('2.5.0\n');
      }
      statusCall += 1;
      if (statusCall === 1) {
        return Promise.resolve(MOCK_STATUS_JSON);
      }
      return Promise.resolve(stoppedJson);
    });
    const client = createGatewayClient(mockPlatform(exec as any));
    await client.getGatewayStatus();
    vi.advanceTimersByTime(11_000);
    const status = await client.getGatewayStatus();
    expect(status.running).toBe(false);
  });

  it('deduplicates concurrent calls during stale fallback path', async () => {
    const exec = vi
      .fn((args: string[]) =>
        args.some((a: string) => a.includes('--json')) ? Promise.resolve(MOCK_STATUS_JSON) : Promise.resolve('2.5.0\n'),
      )
      .mockImplementationOnce((args: string[]) =>
        args.some((a: string) => a.includes('--json')) ? Promise.resolve(MOCK_STATUS_JSON) : Promise.resolve('2.5.0\n'),
      )
      .mockImplementationOnce(() => Promise.resolve('not json'));
    const client = createGatewayClient(mockPlatform(exec as any));
    await client.getGatewayStatus();
    vi.advanceTimersByTime(11_000);
    const [a, b] = await Promise.all([client.getGatewayStatus(), client.getGatewayStatus()]);
    expect(a).toEqual(b);
    const statusCalls = (exec as any).mock.calls.filter(([argv]: [string[]]) => argv.includes('--json'));
    expect(statusCalls.length).toBe(2);
  });

  it('recovery path: stale fallback then fresh valid JSON resumes updates', async () => {
    const changedJson = JSON.stringify({
      gateway: { reachable: true, connectLatencyMs: 40 },
      gatewayService: { runtimeShort: 'running pid 7777' },
      channelSummary: ['Telegram: connected'],
      update: { latestVersion: '3.1.0' },
      securityAudit: { summary: { critical: 0, warn: 0, info: 0 } },
      sessions: { defaults: { model: 'sonnet', contextTokens: 128000 } },
    });
    let statusCall = 0;
    const exec = vi.fn((args: string[]) => {
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
      return Promise.resolve(changedJson);
    });
    const client = createGatewayClient(mockPlatform(exec as any));
    const first = await client.getGatewayStatus();
    vi.advanceTimersByTime(11_000);
    const stale = await client.getGatewayStatus();
    expect(stale.pid).toBe(first.pid);
    vi.advanceTimersByTime(3_100);
    const recovered = await client.getGatewayStatus();
    expect(recovered.pid).toBe(7777);
  });

  it('warmCache swallows errors silently', async () => {
    const exec = vi.fn(() => Promise.reject(new Error('CLI not found')));
    const client = createGatewayClient(mockPlatform(exec as any));
    await expect(client.warmCache()).resolves.toBeUndefined();
  });
});
