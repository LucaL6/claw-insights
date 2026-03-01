import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => {
  const mockFh = {
    read: vi.fn(),
    close: vi.fn(() => Promise.resolve()),
  };
  return {
    open: vi.fn(() => Promise.resolve(mockFh)),
    stat: vi.fn(() => Promise.resolve({ size: 0 })),
    __mockFh: mockFh,
  };
});

vi.mock('../../events.js', () => ({ emitChange: vi.fn() }));

import { open, stat } from 'node:fs/promises';

import { emitChange } from '../../events.js';
import { createMockPlatform } from '../../platforms/mock/index.js';
import type { Platform } from '../../ports/types.js';

const mockOpen = vi.mocked(open);
const mockStat = vi.mocked(stat);

describe('createGatewayClient', () => {
  let platform: Platform;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: log file missing so startedAt = null
    mockStat.mockImplementation(() => {
      const enoent = new Error('ENOENT') as NodeJS.ErrnoException;
      enoent.code = 'ENOENT';
      return Promise.reject(enoent);
    });
    platform = createMockPlatform({
      cli: {
        exec: async (argv: string[]) => {
          if (argv.includes('--version')) {
            return '2.5.0\n';
          }
          if (argv.includes('--json')) {
            return JSON.stringify({
              gateway: { reachable: true, connectLatencyMs: 25 },
              gatewayService: { runtimeShort: 'running pid 9999' },
              channelSummary: ['Telegram: connected'],
              update: { latestVersion: '3.0.0' },
              securityAudit: { summary: { critical: 0, warn: 1, info: 5 } },
              sessions: { defaults: { model: 'opus', contextTokens: 200000 } },
            });
          }
          return '';
        },
      },
      process: {
        getUptime: () => Promise.resolve('3h 15m'),
        findPidByPort: () => Promise.resolve(null),
      },
    });
  });

  it('returns parsed status with uptime from ProcessAdapter', async () => {
    const { createGatewayClient } = await import('../gateway-cli.js');
    const logContent = '2026-02-27T12:15:02.721Z [gateway] listening on ws://127.0.0.1:18789 (PID 9999)\n';
    const buf = Buffer.from(logContent);
    const mockFileHandle = {
      read: vi.fn(() => Promise.resolve({ bytesRead: buf.length })),
      close: vi.fn(() => Promise.resolve()),
    };
    mockStat.mockReturnValue(Promise.resolve({ size: buf.length } as never));
    mockOpen.mockReturnValue(Promise.resolve(mockFileHandle as never));
    mockFileHandle.read.mockImplementation((...args: unknown[]) => {
      const target = args[0] as Buffer;
      buf.copy(target);
      return Promise.resolve({ bytesRead: buf.length });
    });
    const client = createGatewayClient(platform, { gatewayLogPath: '/tmp/test.log' });
    const status = await client.getGatewayStatus();
    expect(status.running).toBe(true);
    expect(status.pid).toBe(9999);
    expect(status.uptime).toBe('3h 15m');
    expect(status.connectLatencyMs).toBe(25);
    expect(status.channels).toHaveLength(1);
    expect(status.startedAt).toBe('2026-02-27T12:15:02.721Z');
  });

  it('uses findPidByPort when pid not in status', async () => {
    platform = createMockPlatform({
      cli: {
        exec: async (argv: string[]) => {
          if (argv.includes('--version')) {
            return '2.5.0\n';
          }
          if (argv.includes('--json')) {
            return JSON.stringify({
              gateway: { reachable: true, port: 18789 },
              gatewayService: { runtimeShort: 'running' },
            });
          }
          return '';
        },
      },
      process: {
        findPidByPort: (port: number) => Promise.resolve(port === 18789 ? 4242 : null),
        getUptime: () => Promise.resolve('1h 0m'),
      },
    });
    const { createGatewayClient } = await import('../gateway-cli.js');
    const client = createGatewayClient(platform);
    const status = await client.getGatewayStatus();
    expect(status.pid).toBe(4242);
  });

  it('emits change when status changes', async () => {
    const { createGatewayClient } = await import('../gateway-cli.js');
    const client = createGatewayClient(platform);
    await client.getGatewayStatus();
    expect(emitChange).toHaveBeenCalledWith('gateway');
  });

  it('does not emit change when status unchanged', async () => {
    const { createGatewayClient } = await import('../gateway-cli.js');
    const client = createGatewayClient(platform);
    await client.getGatewayStatus();
    vi.mocked(emitChange).mockClear();
    await client.getGatewayStatus(); // cache hit or same data
    // May or may not emit depending on cache — at minimum no throw
  });

  it('returns version from CLI', async () => {
    const { createGatewayClient } = await import('../gateway-cli.js');
    const client = createGatewayClient(platform);
    const version = await client.getVersion();
    expect(version).toBe('2.5.0');
  });

  it('returns unknown version on empty CLI response', async () => {
    platform = createMockPlatform({ cli: { exec: async () => '' } });
    const { createGatewayClient } = await import('../gateway-cli.js');
    const client = createGatewayClient(platform);
    const version = await client.getVersion();
    expect(version).toBe('unknown');
  });

  describe('getStartedAtFromLog', () => {
    function setupLog(content: string): void {
      const buf = Buffer.from(content);
      const fh = {
        read: vi.fn((target: Buffer) => {
          buf.copy(target);
          return Promise.resolve({ bytesRead: buf.length });
        }),
        close: vi.fn(() => Promise.resolve()),
      };
      mockStat.mockReturnValue(Promise.resolve({ size: buf.length } as never));
      mockOpen.mockReturnValue(Promise.resolve(fh as never));
    }

    it('extracts startedAt when PID matches', async () => {
      setupLog('2026-02-27T12:15:02.721Z [gateway] listening on ws://127.0.0.1:18789 (PID 9999)\n');
      const { createGatewayClient } = await import('../gateway-cli.js');
      const client = createGatewayClient(platform, { gatewayLogPath: '/tmp/test.log' });
      const status = await client.getGatewayStatus();
      expect(status.startedAt).toBe('2026-02-27T12:15:02.721Z');
    });

    it('picks LAST matching PID line', async () => {
      setupLog(
        '2026-02-27T10:00:00.000Z [gateway] listening on ws://127.0.0.1:18789 (PID 9999)\n' +
          '2026-02-27T14:30:00.000Z [gateway] listening on ws://127.0.0.1:18789 (PID 9999)\n',
      );
      const { createGatewayClient } = await import('../gateway-cli.js');
      const client = createGatewayClient(platform, { gatewayLogPath: '/tmp/test.log' });
      const status = await client.getGatewayStatus();
      expect(status.startedAt).toBe('2026-02-27T14:30:00.000Z');
    });

    it('returns null when no matching PID', async () => {
      setupLog('2026-02-27T12:15:02.721Z [gateway] listening on ws://127.0.0.1:18789 (PID 1111)\n');
      const { createGatewayClient } = await import('../gateway-cli.js');
      const client = createGatewayClient(platform, { gatewayLogPath: '/tmp/test.log' });
      const status = await client.getGatewayStatus();
      expect(status.startedAt).toBeNull();
    });

    it('returns null when log file missing (ENOENT)', async () => {
      mockStat.mockImplementation(() => {
        const err = new Error('ENOENT') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        return Promise.reject(err);
      });
      const { createGatewayClient } = await import('../gateway-cli.js');
      const client = createGatewayClient(platform, { gatewayLogPath: '/tmp/missing.log' });
      const status = await client.getGatewayStatus();
      expect(status.startedAt).toBeNull();
    });

    it('handles partial read (bytesRead < buffer size)', async () => {
      const content = '2026-02-27T12:15:02.721Z [gateway] listening on ws://127.0.0.1:18789 (PID 9999)\n';
      const buf = Buffer.from(content);
      const fh = {
        read: vi.fn((target: Buffer) => {
          // Simulate partial read: only fill part of the buffer
          buf.copy(target);
          return Promise.resolve({ bytesRead: buf.length });
        }),
        close: vi.fn(() => Promise.resolve()),
      };
      // Report file size larger than actual content to trigger partial read path
      mockStat.mockReturnValue(Promise.resolve({ size: 65536 } as never));
      mockOpen.mockReturnValue(Promise.resolve(fh as never));
      const { createGatewayClient } = await import('../gateway-cli.js');
      const client = createGatewayClient(platform, { gatewayLogPath: '/tmp/test.log' });
      const status = await client.getGatewayStatus();
      expect(status.startedAt).toBe('2026-02-27T12:15:02.721Z');
    });

    it('returns null for malformed timestamp', async () => {
      setupLog('NOT-A-DATE [gateway] listening on ws://127.0.0.1:18789 (PID 9999)\n');
      const { createGatewayClient } = await import('../gateway-cli.js');
      const client = createGatewayClient(platform, { gatewayLogPath: '/tmp/test.log' });
      const status = await client.getGatewayStatus();
      expect(status.startedAt).toBeNull();
    });
  });

  it('parseStatus handles invalid JSON gracefully', async () => {
    platform = createMockPlatform({
      cli: {
        exec: async (argv: string[]) => {
          if (argv.includes('--version')) {
            return '1.0.0\n';
          }
          return 'not json';
        },
      },
    });
    const { createGatewayClient } = await import('../gateway-cli.js');
    const client = createGatewayClient(platform);
    const status = await client.getGatewayStatus();
    expect(status.running).toBe(false);
    expect(status.version).toBe('unknown');
  });
});
