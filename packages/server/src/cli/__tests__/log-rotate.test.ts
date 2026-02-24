import { existsSync, mkdtempSync, readFileSync, rmSync, statSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach,beforeEach, describe, expect, it } from 'vitest';

describe('rotateIfNeeded', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'logrotate-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('does nothing when log file is small', async () => {
    const { rotateIfNeeded } = await import('../log-rotate.js');
    const logPath = join(dir, 'server.log');
    writeFileSync(logPath, 'small content');
    const rotated = rotateIfNeeded(logPath, { maxBytes: 1024, maxFiles: 3 });
    expect(rotated).toBe(false);
    expect(readFileSync(logPath, 'utf-8')).toBe('small content');
  });

  it('rotates when log exceeds maxBytes', async () => {
    const { rotateIfNeeded } = await import('../log-rotate.js');
    const logPath = join(dir, 'server.log');
    writeFileSync(logPath, 'x'.repeat(200));
    const rotated = rotateIfNeeded(logPath, { maxBytes: 100, maxFiles: 3 });
    expect(rotated).toBe(true);
    expect(existsSync(logPath + '.1')).toBe(true);
    expect(statSync(logPath).size).toBe(0);
  });

  it('cascades rotated files (1→2, current→1)', async () => {
    const { rotateIfNeeded } = await import('../log-rotate.js');
    const logPath = join(dir, 'server.log');

    writeFileSync(logPath + '.1', 'old-content-1');
    writeFileSync(logPath, 'x'.repeat(200));

    rotateIfNeeded(logPath, { maxBytes: 100, maxFiles: 3 });

    expect(readFileSync(logPath + '.2', 'utf-8')).toBe('old-content-1');
    expect(readFileSync(logPath + '.1', 'utf-8')).toBe('x'.repeat(200));
  });

  it('drops oldest when maxFiles exceeded', async () => {
    const { rotateIfNeeded } = await import('../log-rotate.js');
    const logPath = join(dir, 'server.log');

    writeFileSync(logPath + '.1', 'file1');
    writeFileSync(logPath + '.2', 'file2');
    writeFileSync(logPath + '.3', 'file3');
    writeFileSync(logPath, 'x'.repeat(200));

    rotateIfNeeded(logPath, { maxBytes: 100, maxFiles: 3 });

    expect(existsSync(logPath + '.3')).toBe(true);
    expect(existsSync(logPath + '.4')).toBe(false);
  });

  it('handles missing log file gracefully', async () => {
    const { rotateIfNeeded } = await import('../log-rotate.js');
    const logPath = join(dir, 'nonexistent.log');
    const rotated = rotateIfNeeded(logPath, { maxBytes: 100, maxFiles: 3 });
    expect(rotated).toBe(false);
  });
});
