import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('reclaimLayeredLogs', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'layered-reclaim-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reclaims expired layered files via retention path', async () => {
    const { reclaimLayeredLogs } = await import('../log-rotate.js');

    writeFileSync(join(dir, 'debug.2025-01-01.0001.log'), 'old');
    writeFileSync(join(dir, 'app.2030-01-01.0001.log'), 'new');

    const stats = await reclaimLayeredLogs(dir, { retentionDays: 14, graceHours: 1 });

    expect(stats.filesDeleted).toBe(1);
    expect(existsSync(join(dir, 'debug.2025-01-01.0001.log'))).toBe(false);
    expect(existsSync(join(dir, 'app.2030-01-01.0001.log'))).toBe(true);
  });

  it('passes activeFiles to sweeper when provided', async () => {
    const { reclaimLayeredLogs } = await import('../log-rotate.js');

    writeFileSync(join(dir, 'debug.2025-01-01.0001.log'), 'old');

    const stats = await reclaimLayeredLogs(dir, {
      retentionDays: 14,
      graceHours: 1,
      activeFiles: new Set(['app.log']),
    });

    expect(stats.filesDeleted).toBe(1);
  });
});
