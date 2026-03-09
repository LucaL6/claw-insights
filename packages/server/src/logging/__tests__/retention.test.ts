import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RetentionSweeper } from '../retention.js';

describe('RetentionSweeper', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'retention-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function dateStr(daysAgo: number): string {
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }

  it('deletes files older than retention + grace', async () => {
    const old = `app.${dateStr(20)}.0.log`;
    const recent = `app.${dateStr(1)}.0.log`;
    await writeFile(join(tmpDir, old), 'old data');
    await writeFile(join(tmpDir, recent), 'recent data');

    const sweeper = new RetentionSweeper({ logDir: tmpDir, retentionDays: 14, graceHours: 1 });
    const stats = await sweeper.sweep();

    expect(stats.filesDeleted).toBe(1);
    expect(stats.filesScanned).toBe(2);
    const remaining = await readdir(tmpDir);
    expect(remaining).toContain(recent);
    expect(remaining).not.toContain(old);
  });

  it('never deletes active segments', async () => {
    const old = `app.${dateStr(20)}.0.log`;
    const fullPath = join(tmpDir, old);
    await writeFile(fullPath, 'active data');

    const sweeper = new RetentionSweeper({ logDir: tmpDir });
    sweeper.setActiveFiles([fullPath]);
    const stats = await sweeper.sweep();

    expect(stats.filesDeleted).toBe(0);
    const remaining = await readdir(tmpDir);
    expect(remaining).toContain(old);
  });

  it('ignores non-log files', async () => {
    await writeFile(join(tmpDir, 'readme.txt'), 'hello');
    const sweeper = new RetentionSweeper({ logDir: tmpDir });
    const stats = await sweeper.sweep();
    expect(stats.filesScanned).toBe(0);
  });

  it('handles missing directory gracefully', async () => {
    const sweeper = new RetentionSweeper({ logDir: join(tmpDir, 'nonexistent') });
    const stats = await sweeper.sweep();
    expect(stats.filesScanned).toBe(0);
    expect(stats.filesDeleted).toBe(0);
  });

  it('parseDateFromFilename works', () => {
    expect(RetentionSweeper.parseDateFromFilename('app.2025-01-15.0.log')).toEqual(new Date('2025-01-15T00:00:00Z'));
    expect(RetentionSweeper.parseDateFromFilename('noise.2025-01-15.0.log')).toEqual(new Date('2025-01-15T00:00:00Z'));
    expect(RetentionSweeper.parseDateFromFilename('security.2025-01-15.0.log')).toEqual(
      new Date('2025-01-15T00:00:00Z'),
    );
    expect(RetentionSweeper.parseDateFromFilename('not-a-log.txt')).toBeNull();
  });

  it('tracks bytesReclaimed', async () => {
    const content = 'x'.repeat(1024);
    await writeFile(join(tmpDir, `app.${dateStr(20)}.0.log`), content);
    const sweeper = new RetentionSweeper({ logDir: tmpDir });
    const stats = await sweeper.sweep();
    expect(stats.bytesReclaimed).toBe(1024);
  });

  it('start/stop lifecycle', async () => {
    const sweeper = new RetentionSweeper({ logDir: tmpDir, sweepIntervalMs: 100_000 });
    sweeper.start();
    // Second start is a no-op
    sweeper.start();
    sweeper.stop();
    // Double stop is safe
    sweeper.stop();
  });
});
