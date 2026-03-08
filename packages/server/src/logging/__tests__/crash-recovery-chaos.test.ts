import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LayeredRuntime } from '../runtime.js';
import { LoggingRuntimeState } from '../state.js';

describe('crash recovery chaos', () => {
  let logDir = '';

  beforeEach(async () => {
    logDir = await mkdtemp(join(tmpdir(), 'logging-crash-recovery-'));
    process.env.CLAW_INSIGHTS_LOG_DIR = logDir;
  });

  afterEach(async () => {
    delete process.env.CLAW_INSIGHTS_LOG_DIR;
    await rm(logDir, { recursive: true, force: true });
  });

  it('recovers within durability window after crash + restart', async () => {
    const preCrashState = new LoggingRuntimeState();
    const preCrashRuntime = new LayeredRuntime({ runtimeState: preCrashState });
    preCrashRuntime.write('error', 'crash-test', ['before-crash']);

    const restartAt = Date.now();
    const recoveryState = new LoggingRuntimeState();
    const recoveryRuntime = new LayeredRuntime({ runtimeState: recoveryState });
    recoveryRuntime.write('error', 'crash-test', ['after-restart']);

    await preCrashRuntime.shutdown();
    await recoveryRuntime.shutdown();

    const measuredRecoveryMs = Date.now() - restartAt;
    expect(measuredRecoveryMs).toBeGreaterThanOrEqual(0);

    const signals = recoveryState.snapshot().signals as unknown as Record<string, unknown>;
    const recoveredWithinMs =
      typeof signals.recoveredWithinDurabilityWindowMs === 'number'
        ? signals.recoveredWithinDurabilityWindowMs
        : Number.POSITIVE_INFINITY;

    expect(recoveredWithinMs).toBeLessThanOrEqual(100);
  });
});
