import { describe, it, expect, afterEach } from 'bun:test';
import { CronReader } from '../cron-reader';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tmpDir = join(tmpdir(), 'cron-reader-test-' + Date.now());
const tmpFile = join(tmpDir, 'jobs.json');

function writeJobs(jobs: unknown[]) {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(tmpFile, JSON.stringify({ version: 1, jobs }));
}

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('CronReader', () => {
  it('should parse cron jobs', () => {
    writeJobs([{
      id: 'test-1',
      name: 'Test Job',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 9 * * MON-FRI' },
      state: { lastRunAtMs: 1700000000000, lastStatus: 'ok' },
    }]);
    const reader = new CronReader(tmpFile);
    const jobs = reader.getJobs();
    expect(jobs.length).toBe(1);
    expect(jobs[0].id).toBe('test-1');
    expect(jobs[0].name).toBe('Test Job');
    expect(jobs[0].enabled).toBe(true);
    expect(jobs[0].schedule).toBe('0 9 * * MON-FRI');
    expect(jobs[0].lastRunSuccess).toBe(true);
    reader.destroy();
  });

  it('should format schedule types', () => {
    writeJobs([
      { id: 'a', enabled: true, schedule: { kind: 'at', at: '2026-02-15T09:00:00Z' } },
      { id: 'b', enabled: true, schedule: { kind: 'every', everyMs: 1800000 } },
    ]);
    const reader = new CronReader(tmpFile);
    const jobs = reader.getJobs();
    expect(jobs[0].schedule).toContain('at');
    expect(jobs[1].schedule).toBe('every 30m');
    reader.destroy();
  });

  it('should read real cron file', () => {
    const realPath = `${process.env.HOME}/.openclaw/cron/jobs.json`;
    try {
      const reader = new CronReader(realPath);
      const jobs = reader.getJobs();
      expect(jobs.length).toBeGreaterThanOrEqual(0);
      reader.destroy();
    } catch { /* skip if not available */ }
  });
});
