// src/platforms/shared/__tests__/posix-process-adapter.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';

import { PosixProcessAdapter } from '../posix-process-adapter.js';

// Concrete subclass for testing (getPid and findPidByPort are abstract-like)
class TestAdapter extends PosixProcessAdapter {
  async getPid(): Promise<number | null> {
    return null;
  }
  async findPidByPort(_port: number): Promise<number | null> {
    return null;
  }
}

describe('PosixProcessAdapter', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new TestAdapter();
  });

  describe('getProcessMetrics', () => {
    it('returns cpu and memoryMB from ps output', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(null, { stdout: '  524288  12.5' }),
      );
      expect(await adapter.getProcessMetrics(123)).toEqual({ cpu: 12.5, memoryMB: 512 });
    });

    it('returns null on exec failure', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error('fail')),
      );
      expect(await adapter.getProcessMetrics(123)).toBeNull();
    });

    it('returns null on parse failure (bad output)', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(null, { stdout: 'garbage' }),
      );
      expect(await adapter.getProcessMetrics(123)).toBeNull();
    });
  });

  describe('getUptime', () => {
    it('formats uptime from ps etime output', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(null, { stdout: '  02:30:15\n' }),
      );
      expect(await adapter.getUptime(123)).toBe('2h 30m');
    });

    it('returns unknown on ps failure', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error('fail')),
      );
      expect(await adapter.getUptime(123)).toBe('unknown');
    });
  });

  describe('getDiskMB', () => {
    it('returns disk usage from du output', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) =>
          cb(null, { stdout: '256\t/home/test/.openclaw/\n' }),
      );
      expect(await adapter.getDiskMB('/home/test/.openclaw')).toBe(256);
    });

    it('returns 0 on failure', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error('fail')),
      );
      expect(await adapter.getDiskMB('/bad')).toBe(0);
    });
  });
});
