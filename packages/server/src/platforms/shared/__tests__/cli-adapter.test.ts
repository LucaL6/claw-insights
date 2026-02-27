// src/platforms/shared/__tests__/cli-adapter.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

import { execFile } from 'node:child_process';

import { PosixCliAdapter } from '../cli-adapter.js';

describe('PosixCliAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exec returns stdout on success', async () => {
    (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(null, { stdout: 'ok\n' }),
    );
    const adapter = new PosixCliAdapter('/usr/bin/openclaw', {});
    expect(await adapter.exec(['--version'])).toBe('ok\n');
  });

  it('exec returns empty string on failure', async () => {
    (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => cb(new Error('fail')),
    );
    const adapter = new PosixCliAdapter('/usr/bin/openclaw', {});
    expect(await adapter.exec(['--version'])).toBe('');
  });

  it('exec passes argv as-is without splitting', async () => {
    (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb: Function) => {
        cb(null, { stdout: args.join(',') });
      },
    );
    const adapter = new PosixCliAdapter('/usr/bin/openclaw', {});
    const result = await adapter.exec(['status', '--json']);
    expect(result).toBe('status,--json');
  });
});
