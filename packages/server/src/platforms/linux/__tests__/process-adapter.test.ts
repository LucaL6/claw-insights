// src/platforms/linux/__tests__/process-adapter.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
vi.mock('node:fs', () => ({ readFileSync: vi.fn(), readdirSync: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: vi.fn(), readdir: vi.fn(), readlink: vi.fn() }));

import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { readdir, readFile, readlink } from 'node:fs/promises';

import { LinuxProcessAdapter } from '../process-adapter.js';

describe('LinuxProcessAdapter', () => {
  let adapter: LinuxProcessAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new LinuxProcessAdapter();
  });

  // ── getPid (Linux-specific: pgrep + /proc/cmdline) ──

  describe('getPid', () => {
    it('finds PID via pgrep', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, args: string[], _opts: unknown, cb: Function) => {
          if (args[0] === '-f') {
            cb(null, { stdout: '45678\n' });
          } else {
            cb(new Error('unexpected'));
          }
        },
      );
      expect(await adapter.getPid()).toBe(45678);
    });

    it('finds PID via /proc/cmdline when pgrep fails', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error('pgrep not found')),
      );
      (readdirSync as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (path === '/proc') {
          return ['1', '500', '501', 'self'];
        }
        return [];
      });
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (path === '/proc/500/cmdline') {
          return '/usr/bin/node\0/usr/lib/openclaw/gateway\0start\0';
        }
        if (path === '/proc/501/cmdline') {
          return '/usr/bin/bash\0';
        }
        throw new Error('not found');
      });
      expect(await adapter.getPid()).toBe(500);
    });

    it('picks first pgrep result when multiple PIDs returned', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(null, { stdout: '100\n200\n' }),
      );
      expect(await adapter.getPid()).toBe(100);
    });

    it('returns null when pgrep fails and /proc has no match', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error('not found')),
      );
      (readdirSync as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (path === '/proc') {
          return ['1'];
        }
        return [];
      });
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
        if (path === '/proc/1/cmdline') {
          return '/sbin/init\0';
        }
        throw new Error('not found');
      });
      expect(await adapter.getPid()).toBeNull();
    });

    it('returns null when both pgrep and /proc scan fail', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error('fail')),
      );
      (readdirSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('no /proc');
      });
      expect(await adapter.getPid()).toBeNull();
    });
  });

  // ── findPidByPort (Linux-specific: /proc/net/tcp) ──

  describe('findPidByPort', () => {
    it('finds PID via /proc/net/tcp socket inode lookup', async () => {
      // Port 18789 = 0x4965
      vi.mocked(readFile).mockImplementation((path: any) => {
        if (path === '/proc/net/tcp') {
          return Promise.resolve(
            '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n' +
              '   0: 0100007F:4965 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 12345 1 0000000000000000 100 0 0 10 0\n',
          );
        }
        return Promise.reject(new Error('not found'));
      });
      vi.mocked(readdir).mockImplementation((path: any) => {
        if (path === '/proc') {
          return Promise.resolve(['1', '42', 'self'] as any);
        }
        if (path === '/proc/42/fd') {
          return Promise.resolve(['0', '1', '3'] as any);
        }
        return Promise.resolve([] as any);
      });
      vi.mocked(readlink).mockImplementation((path: any) => {
        if (path === '/proc/42/fd/3') {
          return Promise.resolve('socket:[12345]');
        }
        return Promise.resolve('');
      });

      expect(await adapter.findPidByPort(18789)).toBe(42);
    });

    it('returns null when no matching port found', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('not found'));
      expect(await adapter.findPidByPort(18789)).toBeNull();
    });

    it('returns null when inode found but no matching fd', async () => {
      vi.mocked(readFile).mockImplementation((path: any) => {
        if (path === '/proc/net/tcp') {
          return Promise.resolve(
            '  sl  local_address\n   0: 0100007F:4965 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 99999 1\n',
          );
        }
        return Promise.reject(new Error('not found'));
      });
      vi.mocked(readdir).mockImplementation((path: any) => {
        if (path === '/proc') {
          return Promise.resolve(['1'] as any);
        }
        if (path === '/proc/1/fd') {
          return Promise.resolve(['0'] as any);
        }
        return Promise.resolve([] as any);
      });
      vi.mocked(readlink).mockResolvedValue('pipe:[111]');

      expect(await adapter.findPidByPort(18789)).toBeNull();
    });
  });

  // ── getUptime (Linux override: ps + /proc fallback) ──

  describe('getUptime', () => {
    it('uses ps first (POSIX base)', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(null, { stdout: '  01:15:30\n' }),
      );
      expect(await adapter.getUptime(123)).toBe('1h 15m');
    });

    it('falls back to /proc/PID/stat when ps fails', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error('no ps')),
      );
      vi.mocked(readFile).mockImplementation((path: any) => {
        if (path === '/proc/123/stat') {
          return Promise.resolve(
            '123 (node) S 1 123 123 0 -1 4194304 1000 0 0 0 100 50 0 0 20 0 1 0 500 1000000 500 4294967295 0 0 0 0 0 0 0 0 0 0 0 0 17 0 0 0 0 0 0',
          );
        }
        if (path === '/proc/uptime') {
          return Promise.resolve('1000.50 2000.00');
        }
        return Promise.reject(new Error('not found'));
      });
      const result = await adapter.getUptime(123);
      expect(result).toMatch(/\d+m/);
    });

    it('returns unknown when both methods fail', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error()),
      );
      vi.mocked(readFile).mockRejectedValue(new Error());
      expect(await adapter.getUptime(123)).toBe('unknown');
    });

    it('uses dynamic CLK_TCK from getconf', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          if (cmd === 'getconf') {
            cb(null, { stdout: '250\n' });
          } else {
            cb(new Error('no ps'));
          }
        },
      );
      vi.mocked(readFile).mockImplementation((path: any) => {
        if (path === '/proc/123/stat') {
          // startTicks = 625000, CLK_TCK=250 → processStartSec = 2500
          return Promise.resolve(
            '123 (node) S 1 123 123 0 -1 4194304 0 0 0 0 0 0 0 0 0 0 0 0 625000 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
          );
        }
        if (path === '/proc/uptime') {
          // bootSeconds = 10000, elapsed = 10000 - 2500 = 7500s = 2h 5m 0s
          return Promise.resolve('10000.00 5000.00');
        }
        return Promise.reject(new Error('not found'));
      });
      expect(await adapter.getUptime(123)).toBe('2h 5m');
    });

    it('falls back to CLK_TCK=100 when getconf fails', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (cmd: string, _args: string[], _opts: unknown, cb: Function) => {
          if (cmd === 'getconf') {
            cb(new Error('not found'));
          } else {
            cb(new Error('no ps'));
          }
        },
      );
      vi.mocked(readFile).mockImplementation((path: any) => {
        if (path === '/proc/123/stat') {
          // startTicks = 100000, CLK_TCK=100 → processStartSec = 1000
          return Promise.resolve(
            '123 (node) S 1 123 123 0 -1 4194304 0 0 0 0 0 0 0 0 0 0 0 0 100000 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
          );
        }
        if (path === '/proc/uptime') {
          // bootSeconds = 2000, elapsed = 2000 - 1000 = 1000s = 16m 40s
          return Promise.resolve('2000.00 1000.00');
        }
        return Promise.reject(new Error('not found'));
      });
      expect(await adapter.getUptime(123)).toBe('16m 40s');
    });

    it('formats as seconds only when uptime < 60s (L149)', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error()),
      );
      vi.mocked(readFile).mockImplementation((path: any) => {
        if (path === '/proc/123/stat') {
          // startTicks = 99950 (ticks), uptime = 1000s, CLK_TCK=100 → startSec=999.5
          // elapsed = 1000 - 999.5 = 0.5 → floor = 0? No, let's be more precise:
          // We want elapsed ~45s: uptime=1000, startTicks=95500 → startSec=955 → elapsed=45
          return Promise.resolve(
            '123 (node) S 1 123 123 0 -1 4194304 0 0 0 0 0 0 0 0 0 0 0 0 95500 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
          );
        }
        if (path === '/proc/uptime') {
          return Promise.resolve('1000.00 2000.00');
        }
        return Promise.reject(new Error('not found'));
      });
      expect(await adapter.getUptime(123)).toBe('45s');
    });

    it('returns unknown when elapsed time is negative', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error()),
      );
      vi.mocked(readFile).mockImplementation((path: any) => {
        if (path === '/proc/123/stat') {
          // startTicks very high → elapsed negative
          return Promise.resolve(
            '123 (node) S 1 123 123 0 -1 4194304 0 0 0 0 0 0 0 0 0 0 0 0 999999999 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
          );
        }
        if (path === '/proc/uptime') {
          return Promise.resolve('100.00 200.00');
        }
        return Promise.reject(new Error('not found'));
      });
      expect(await adapter.getUptime(123)).toBe('unknown');
    });
  });
});
