/**
 * P0 Contract Tests: Startup usage seed.
 *
 * On startup, the runtime MUST scan the log directory and seed the budget gate
 * with current usage so that limits are enforced from the first write.
 */
import { describe, expect, it } from 'vitest';

import { seedUsageFromDisk } from '../startup-usage.js';
import type { FsMock } from './test-helpers.js';

describe('Startup usage seed', () => {
  it('seeds from active + rotated log files', () => {
    const fsMock: FsMock = {
      readdirSync: () => ['app.log', 'app.log.1', 'error.log', 'debug.log.2'],
      statSync: (path: string) => {
        const sizes: Record<string, number> = {
          'app.log': 1000,
          'app.log.1': 2000,
          'error.log': 500,
          'debug.log.2': 300,
        };
        const name = path.split('/').pop()!;
        return { size: sizes[name] ?? 0, mtimeMs: Date.now() };
      },
      existsSync: () => true,
    };

    const result = seedUsageFromDisk('/var/log/claw', fsMock);

    expect(result.totalBytes).toBe(3800);
    expect(result.byStream.app).toBe(3000); // app.log + app.log.1
    expect(result.byStream.error).toBe(500);
    expect(result.byStream.debug).toBe(300);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles empty log directory', () => {
    const fsMock: FsMock = {
      readdirSync: () => [],
      statSync: () => ({ size: 0, mtimeMs: Date.now() }),
      existsSync: () => true,
    };

    const result = seedUsageFromDisk('/var/log/claw', fsMock);

    expect(result.totalBytes).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('emits EACCES warning signal when directory is unreadable', () => {
    const fsMock: FsMock = {
      readdirSync: () => {
        const err = new Error('Permission denied') as NodeJS.ErrnoException;
        err.code = 'EACCES';
        throw err;
      },
      statSync: () => ({ size: 0, mtimeMs: Date.now() }),
      existsSync: () => true,
    };

    const result = seedUsageFromDisk('/var/log/claw', fsMock);

    expect(result.totalBytes).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/EACCES|permission/i);
  });
});
