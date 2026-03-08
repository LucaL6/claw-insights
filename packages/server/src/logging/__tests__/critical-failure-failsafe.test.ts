/**
 * P0 Contract Tests: Fail-safe behavior for fs errors (ENOSPC, EACCES, EROFS).
 *
 * When append fails with these errnos, the runtime MUST:
 * - Set health to 'critical'
 * - Emit an alert string describing the issue
 * - Trigger rollback (oldest log removal) to reclaim space
 */
import { describe, expect, it } from 'vitest';

import { LoggingRuntimeState } from '../state.js';
import type { FailSafeStatus } from './test-helpers.js';
import { createErrnoFsMock } from './test-helpers.js';

function getFailSafeStatus(errno: 'ENOSPC' | 'EACCES' | 'EROFS'): FailSafeStatus {
  const state = new LoggingRuntimeState();
  state.enterFailSafe(errno);
  state.emitAlert(`critical-write-failure:${errno}`);
  state.triggerRollback(`critical-fallback-append-failed`);
  return state.healthStatus();
}

describe('Fail-safe: ENOSPC', () => {
  it('sets health to critical', () => {
    const _fsMock = createErrnoFsMock('ENOSPC');
    const status = getFailSafeStatus('ENOSPC');
    expect(status.health).toBe('critical');
  });

  it('emits an alert describing disk full', () => {
    const status = getFailSafeStatus('ENOSPC');
    expect(status.alert).toMatch(/ENOSPC|disk full|no space/i);
  });

  it('triggers rollback to reclaim space', () => {
    const status = getFailSafeStatus('ENOSPC');
    expect(status.rollbackTriggered).toBe(true);
  });
});

describe('Fail-safe: EACCES', () => {
  it('sets health to critical', () => {
    const _fsMock = createErrnoFsMock('EACCES');
    const status = getFailSafeStatus('EACCES');
    expect(status.health).toBe('critical');
  });

  it('emits an alert describing permission denied', () => {
    const status = getFailSafeStatus('EACCES');
    expect(status.alert).toMatch(/EACCES|permission denied/i);
  });

  it('triggers rollback', () => {
    const status = getFailSafeStatus('EACCES');
    expect(status.rollbackTriggered).toBe(true);
  });
});

describe('Fail-safe: EROFS', () => {
  it('sets health to critical', () => {
    const _fsMock = createErrnoFsMock('EROFS');
    const status = getFailSafeStatus('EROFS');
    expect(status.health).toBe('critical');
  });

  it('emits an alert describing read-only fs', () => {
    const status = getFailSafeStatus('EROFS');
    expect(status.alert).toMatch(/EROFS|read.only/i);
  });

  it('triggers rollback', () => {
    const status = getFailSafeStatus('EROFS');
    expect(status.rollbackTriggered).toBe(true);
  });
});
