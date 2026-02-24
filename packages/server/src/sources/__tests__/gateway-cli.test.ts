import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockCb: (cmd: string, args: string[], opts: any, cb: Function) => void;

vi.mock('node:child_process', () => ({
  execFile: (cmd: string, args: string[], opts: any, cb: Function) => mockCb(cmd, args, opts, cb),
}));

vi.mock('../../config.js', () => ({
  config: { cliPath: '/usr/bin/openclaw' },
  CLI_ENV: {},
}));

vi.mock('../../events.js', () => ({
  emitChange: vi.fn(),
}));

const MOCK_STATUS_JSON = JSON.stringify({
  gateway: { reachable: true, connectLatencyMs: 25 },
  gatewayService: { runtimeShort: 'running pid 9999' },
  channelSummary: ['Telegram: connected', 'Discord: connected'],
  update: { latestVersion: '3.0.0' },
  securityAudit: { summary: { critical: 0, warn: 1, info: 5 } },
  sessions: { defaults: { model: 'opus', contextTokens: 200000 } },
});

describe('gateway-cli extended fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockCb = (_cmd, args, _opts, cb) => {
      if (args.some((a: string) => a.includes('--json'))) {
        cb(null, { stdout: MOCK_STATUS_JSON });
      } else {
        cb(null, { stdout: '2.5.0\n' });
      }
    };
  });

  it('should include connectLatencyMs in gateway status', async () => {
    const { getGatewayStatus } = await import('../gateway-cli');
    const status = await getGatewayStatus();
    expect(status.connectLatencyMs).toBe(25);
  });

  it('should include latestVersion in gateway status', async () => {
    const { getGatewayStatus } = await import('../gateway-cli');
    const status = await getGatewayStatus();
    expect(status.latestVersion).toBe('3.0.0');
  });

  it('should include securitySummary in gateway status', async () => {
    const { getGatewayStatus } = await import('../gateway-cli');
    const status = await getGatewayStatus();
    expect(status.securitySummary).toEqual({ critical: 0, warn: 1, info: 5 });
  });

  it('should include sessionDefaults in gateway status', async () => {
    const { getGatewayStatus } = await import('../gateway-cli');
    const status = await getGatewayStatus();
    expect(status.sessionDefaults).toEqual({ model: 'opus', contextTokens: 200000 });
  });

  it('deduplicates concurrent calls (in-flight guard)', async () => {
    let callCount = 0;
    mockCb = (_cmd, args, _opts, cb) => {
      callCount++;
      // Simulate slow CLI response
      setTimeout(() => {
        if (args.some((a: string) => a.includes('--json'))) {
          cb(null, { stdout: MOCK_STATUS_JSON });
        } else {
          cb(null, { stdout: '2.5.0\n' });
        }
      }, 50);
    };

    const { getGatewayStatus } = await import('../gateway-cli');
    // Fire two concurrent calls
    const [a, b] = await Promise.all([getGatewayStatus(), getGatewayStatus()]);

    // Both should return identical results
    expect(a.running).toBe(true);
    expect(b.running).toBe(true);
    expect(a).toBe(b); // same object reference (in-flight dedup)

    // CLI should only be called once per command (status + version = 2), not doubled
    // With dedup: 2 calls (status --json + --version)
    // Without dedup: 4 calls (2x each)
    expect(callCount).toBeLessThanOrEqual(2);
  });
});
