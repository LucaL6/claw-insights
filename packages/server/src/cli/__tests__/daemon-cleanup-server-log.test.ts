import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cleanupLegacyServerLogs } from '../daemon.js';

describe('cleanupLegacyServerLogs', () => {
  let logDir: string;

  beforeEach(() => {
    logDir = mkdtempSync(join(tmpdir(), 'cleanup-server-log-'));
  });

  afterEach(() => {
    rmSync(logDir, { recursive: true, force: true });
  });

  it('removes server.log and server.log.* files', () => {
    writeFileSync(join(logDir, 'server.log'), 'old');
    writeFileSync(join(logDir, 'server.log.1'), 'older');
    writeFileSync(join(logDir, 'server.log.2'), 'oldest');
    writeFileSync(join(logDir, 'app.2026-03-09.0001.log'), 'keep');

    const removed = cleanupLegacyServerLogs(logDir);

    expect(removed).toBe(3);
    expect(existsSync(join(logDir, 'server.log'))).toBe(false);
    expect(existsSync(join(logDir, 'server.log.1'))).toBe(false);
    expect(existsSync(join(logDir, 'server.log.2'))).toBe(false);
    expect(existsSync(join(logDir, 'app.2026-03-09.0001.log'))).toBe(true);
  });

  it('returns 0 when no server.log files exist', () => {
    writeFileSync(join(logDir, 'app.2026-03-09.0001.log'), 'keep');
    expect(cleanupLegacyServerLogs(logDir)).toBe(0);
  });

  it('handles missing directory gracefully', () => {
    expect(cleanupLegacyServerLogs(join(logDir, 'nonexistent'))).toBe(0);
  });
});
