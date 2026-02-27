// src/platforms/darwin/__tests__/process-adapter.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFile: vi.fn(), execFileSync: vi.fn() }));

import { execFile } from 'node:child_process';

import { DarwinProcessAdapter } from '../process-adapter.js';

describe('DarwinProcessAdapter', () => {
  let adapter: DarwinProcessAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new DarwinProcessAdapter();
  });

  describe('getPid', () => {
    it('returns PID from launchctl output', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) =>
          cb(null, { stdout: '45678\t0\tai.openclaw.gateway\n' }),
      );
      expect(await adapter.getPid()).toBe(45678);
    });

    it('returns null when service not found', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) =>
          cb(null, { stdout: '123\t0\tcom.example.other\n' }),
      );
      expect(await adapter.getPid()).toBeNull();
    });

    it('returns null on launchctl failure', async () => {
      (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error('fail')),
      );
      expect(await adapter.getPid()).toBeNull();
    });
  });

  describe('findPidByPort', () => {
    it('returns null (not supported on macOS)', async () => {
      expect(await adapter.findPidByPort(18789)).toBeNull();
    });
  });

  // getProcessMetrics, getUptime, getDiskMB are tested in PosixProcessAdapter base
});
