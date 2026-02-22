import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('PidFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pid-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes and reads PID', async () => {
    const { PidFile } = await import('../pid.js');
    const pf = new PidFile(join(dir, 'test.pid'));
    pf.write(12345);
    expect(pf.read()).toBe(12345);
  });

  it('returns null when no PID file', async () => {
    const { PidFile } = await import('../pid.js');
    const pf = new PidFile(join(dir, 'nonexistent.pid'));
    expect(pf.read()).toBeNull();
  });

  it('removes PID file', async () => {
    const { PidFile } = await import('../pid.js');
    const pidPath = join(dir, 'test.pid');
    const pf = new PidFile(pidPath);
    pf.write(12345);
    pf.remove();
    expect(existsSync(pidPath)).toBe(false);
  });

  it('detects stale PID (process not running)', async () => {
    const { PidFile } = await import('../pid.js');
    const pf = new PidFile(join(dir, 'test.pid'));
    // Use a PID that almost certainly doesn't exist
    pf.write(999999);
    expect(pf.isAlive()).toBe(false);
  });

  it('detects alive PID (current process)', async () => {
    const { PidFile } = await import('../pid.js');
    const pf = new PidFile(join(dir, 'test.pid'));
    pf.write(process.pid);
    expect(pf.isAlive()).toBe(true);
  });

  it('cleans up stale PID and allows re-write', async () => {
    const { PidFile } = await import('../pid.js');
    const pf = new PidFile(join(dir, 'test.pid'));
    pf.write(999999); // stale
    expect(pf.isAlive()).toBe(false);
    pf.cleanStale();
    pf.write(process.pid);
    expect(pf.read()).toBe(process.pid);
  });
});
