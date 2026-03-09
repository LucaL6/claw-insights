import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hasPortConflictHint, readRecentLayeredErrorHints, selectDefaultLayeredLogFiles } from '../daemon.js';

describe('daemon layered log helpers', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'daemon-layered-logs-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('selects latest error/app files and excludes debug/noise/security from default view', () => {
    writeFileSync(join(dir, 'error.2026-03-07.0001.log'), 'old-error');
    writeFileSync(join(dir, 'error.2026-03-08.0002.log'), 'new-error');
    writeFileSync(join(dir, 'app.2026-03-08.0001.log'), 'app-log');
    writeFileSync(join(dir, 'debug.2026-03-08.0001.log'), 'debug-log');
    writeFileSync(join(dir, 'noise.2026-03-08.0001.log'), 'noise-log');
    writeFileSync(join(dir, 'security.2026-03-08.0001.log'), 'security-log');

    const selected = selectDefaultLayeredLogFiles(dir);

    expect(selected.some((p) => p.endsWith('error.2026-03-08.0002.log'))).toBe(true);
    expect(selected.some((p) => p.endsWith('app.2026-03-08.0001.log'))).toBe(true);
    expect(selected.some((p) => p.includes('/debug.'))).toBe(false);
    expect(selected.some((p) => p.includes('/noise.'))).toBe(false);
    expect(selected.some((p) => p.includes('/security.'))).toBe(false);
  });

  it('reads hints from latest error segment', () => {
    writeFileSync(join(dir, 'error.2026-03-07.0001.log'), 'older\nEADDRINUSE old\n');
    writeFileSync(join(dir, 'error.2026-03-08.0002.log'), 'newer\nalready in use\n');

    const hints = readRecentLayeredErrorHints(dir, 5);

    expect(hints.join('\n')).toContain('already in use');
    expect(hints.join('\n')).not.toContain('EADDRINUSE old');
  });

  it('detects port-conflict hints', () => {
    expect(hasPortConflictHint(['foo', 'EADDRINUSE: 41041'])).toBe(true);
    expect(hasPortConflictHint(['foo', 'address already in use'])).toBe(true);
    expect(hasPortConflictHint(['foo', 'bar'])).toBe(false);
  });

  it('returns empty list when directory does not exist', () => {
    const selected = selectDefaultLayeredLogFiles(join(dir, 'missing'));
    expect(selected).toEqual([]);
  });

  it('daemonLogs prints layered-only guidance when no files exist', async () => {
    const home = mkdtempSync(join(tmpdir(), 'daemon-home-'));
    mkdirSync(join(home, '.claw-insights', 'logs'), { recursive: true });

    const oldHome = process.env.HOME;
    process.env.HOME = home;
    vi.resetModules();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // suppress output
    });

    try {
      const daemonModule = await import('../daemon.js');
      daemonModule.daemonLogs();

      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('No layered log files found.');
      expect(output).toContain('claw-insights status');
      expect(output).toContain('claw-insights start');
    } finally {
      process.env.HOME = oldHome;
      rmSync(home, { recursive: true, force: true });
    }
  });
});
