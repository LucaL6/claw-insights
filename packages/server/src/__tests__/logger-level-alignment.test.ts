import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('logger level alignment', () => {
  let logDir = '';

  beforeEach(async () => {
    logDir = await mkdtemp(join(tmpdir(), 'logger-level-alignment-'));
    process.env.CLAW_INSIGHTS_LOG_DIR = logDir;
    process.env.LOG_LEVEL = 'info';
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.CLAW_INSIGHTS_LOG_DIR;
    delete process.env.LOG_LEVEL;
    vi.resetModules();
    await rm(logDir, { recursive: true, force: true });
  });

  it('does not write layered debug records when logger level is info', async () => {
    const { createChildLogger } = await import('../logger.js');
    const log = createChildLogger('level-alignment-test');

    log.debug('debug should be filtered');
    log.info('info should pass');

    const files = await readdir(logDir);
    const debugFiles = files.filter((f) => f.startsWith('debug.'));

    let layeredDebugWrites = 0;
    for (const file of debugFiles) {
      const content = await readFile(join(logDir, file), 'utf-8');
      layeredDebugWrites += content.split('\n').filter(Boolean).length;
    }

    expect(layeredDebugWrites).toBe(0);
  });
});
