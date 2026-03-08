import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LayeredRuntime } from '../runtime.js';
import { LoggingRuntimeState } from '../state.js';

describe('startup integrity integration', () => {
  let logDir = '';

  beforeEach(async () => {
    logDir = await mkdtemp(join(tmpdir(), 'logging-integrity-startup-'));
    process.env.CLAW_INSIGHTS_LOG_DIR = logDir;
  });

  afterEach(async () => {
    delete process.env.CLAW_INSIGHTS_LOG_DIR;
    delete process.env.CLAW_INSIGHTS_CRITICAL_QUEUE_MAX;
    await rm(logDir, { recursive: true, force: true });
  });

  it('repairs truncated tail before first append on startup', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const segment = join(logDir, `error.${today}.0001.log`);
    await writeFile(segment, '{"ok":1}\n{"trunc');

    const state = new LoggingRuntimeState();
    const runtime = new LayeredRuntime({ runtimeState: state });

    runtime.write('error', 'integrity-startup-test', ['first append after restart']);
    await runtime.shutdown();

    const repaired = await readFile(segment, 'utf-8');
    expect(repaired.includes('{"trunc')).toBe(false);

    const signals = state.snapshot().signals as unknown as Record<string, unknown>;
    expect(signals.tailRepairCount).toBe(1);
    expect(signals.firstAppendAfterRepair).toBe(true);
  });

  it('marks first append after repair even when critical write takes fallback path', async () => {
    process.env.CLAW_INSIGHTS_CRITICAL_QUEUE_MAX = '0';

    const today = new Date().toISOString().slice(0, 10);
    const segment = join(logDir, `error.${today}.0001.log`);
    await writeFile(segment, '{"ok":1}\n{"trunc');

    const state = new LoggingRuntimeState();
    const runtime = new LayeredRuntime({ runtimeState: state });

    runtime.write('error', 'integrity-startup-fallback', ['fallback append after repair']);
    await runtime.shutdown();

    const signals = state.snapshot().signals as unknown as Record<string, unknown>;
    expect(signals.tailRepairCount).toBe(1);
    expect(signals.firstAppendAfterRepair).toBe(true);
  });
});
