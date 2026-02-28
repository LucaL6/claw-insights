import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { CronReader } from '../cron-reader';

const tmpDir = join(tmpdir(), 'cron-br-test-' + Date.now());
const tmpFile = join(tmpDir, 'jobs.json');

function writeJobs(jobs: unknown[]) {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(tmpFile, JSON.stringify({ version: 1, jobs }));
}

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('CronReader branches', () => {
  it('formats unknown schedule kind as kind string', () => {
    writeJobs([{ id: 'a', enabled: true, schedule: { kind: 'manual' } }]);
    const reader = new CronReader(tmpFile);
    expect(reader.getJobs()[0].schedule).toBe('manual');
    reader.destroy();
  });

  it('handles missing name (null)', () => {
    writeJobs([{ id: 'a', enabled: true, schedule: { kind: 'cron', expr: '* * * * *' } }]);
    const reader = new CronReader(tmpFile);
    expect(reader.getJobs()[0].name).toBeNull();
    reader.destroy();
  });

  it('handles lastStatus = "error" → lastRunSuccess = false', () => {
    writeJobs([
      {
        id: 'a',
        enabled: true,
        schedule: { kind: 'cron', expr: '* * * * *' },
        state: { lastRunAtMs: 1700000000000, lastStatus: 'error' },
      },
    ]);
    const reader = new CronReader(tmpFile);
    expect(reader.getJobs()[0].lastRunSuccess).toBe(false);
    reader.destroy();
  });

  it('handles missing state → lastRunAt null, lastRunSuccess null', () => {
    writeJobs([{ id: 'a', enabled: true, schedule: { kind: 'cron', expr: '* * * * *' } }]);
    const reader = new CronReader(tmpFile);
    const job = reader.getJobs()[0];
    expect(job.lastRunAt).toBeNull();
    expect(job.lastRunSuccess).toBeNull();
    reader.destroy();
  });

  it('handles non-existent file gracefully', () => {
    const reader = new CronReader('/nonexistent/path/jobs.json');
    expect(reader.getJobs()).toEqual([]);
    reader.destroy();
  });

  it('onChange registers and destroy clears listeners', () => {
    writeJobs([]);
    const reader = new CronReader(tmpFile);
    let called = false;
    reader.onChange(() => {
      called = true;
    });
    reader.destroy();
    expect(called).toBe(false);
  });
});
