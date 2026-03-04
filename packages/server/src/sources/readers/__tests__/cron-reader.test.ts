import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CronReader } from '../cron-reader.js';

function writeCronFile(filePath: string, jobs: unknown[]): void {
  writeFileSync(filePath, JSON.stringify({ version: 1, jobs }));
}

const DEFAULT_JOB = {
  id: 'job-1',
  name: 'Test Job',
  enabled: true,
  schedule: { kind: 'cron', expr: '* * * * *' },
};

/** Poll until condition is true or timeout. Avoids fixed setTimeout. */
async function waitUntil(fn: () => boolean, timeoutMs = 3000, intervalMs = 50): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

describe('CronReader', () => {
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'cron-reader-test-'));
    testFile = join(testDir, 'cron.json');
    writeCronFile(testFile, [DEFAULT_JOB]);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('getJobs', () => {
    it('should parse cron jobs from file', () => {
      const reader = new CronReader(testFile);
      const jobs = reader.getJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('job-1');
      expect(jobs[0].name).toBe('Test Job');
      expect(jobs[0].enabled).toBe(true);
      expect(jobs[0].schedule).toBe('* * * * *');
      reader.destroy();
    });

    it('should format different schedule types', () => {
      writeCronFile(testFile, [
        { id: 'a', enabled: true, schedule: { kind: 'at', at: '2026-03-04T09:00:00Z' } },
        { id: 'b', enabled: true, schedule: { kind: 'every', everyMs: 1800000 } },
      ]);
      const reader = new CronReader(testFile);
      const jobs = reader.getJobs();

      expect(jobs[0].schedule).toContain('at');
      expect(jobs[1].schedule).toBe('every 30m');
      reader.destroy();
    });
  });

  describe('onChange', () => {
    it('should return an unsubscribe function', () => {
      const reader = new CronReader(testFile);
      const callback = vi.fn();

      const unsubscribe = reader.onChange(callback);

      expect(typeof unsubscribe).toBe('function');
      reader.destroy();
    });

    it('should remove only the target listener on unsubscribe', async () => {
      const reader = new CronReader(testFile);
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = reader.onChange(cb1);
      reader.onChange(cb2);

      unsub1();

      let seq = 0;

      // Keep touching file while polling so we don't rely on watcher-attach timing.
      await waitUntil(
        () => {
          seq += 1;
          writeCronFile(testFile, [
            {
              id: `job-2-${seq}`,
              name: `New Job ${seq}`,
              enabled: true,
              schedule: { kind: 'cron', expr: '0 * * * *' },
            },
          ]);
          return cb2.mock.calls.length > 0;
        },
        3000,
        400,
      );

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
      reader.destroy();
    });

    it('should be idempotent on multiple unsubscribe calls', () => {
      const reader = new CronReader(testFile);
      const callback = vi.fn();

      const unsubscribe = reader.onChange(callback);

      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();

      reader.destroy();
    });

    it('should not call removed listeners after destroy', () => {
      const reader = new CronReader(testFile);
      const callback = vi.fn();

      reader.onChange(callback);
      reader.destroy();

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
