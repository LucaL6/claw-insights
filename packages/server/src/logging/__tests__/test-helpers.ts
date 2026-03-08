/**
 * Test helpers for logging robustness P0 contract tests.
 * These types define the contract that the runtime MUST satisfy.
 */

export interface TestRuntimeOptions {
  /** Simulate critical queue being full */
  criticalQueueFull?: boolean;
  /** Simulate budget gate denying critical writes */
  denyCriticalByBudget?: boolean;
  /** Simulate fs append errno */
  appendErrno?: 'ENOSPC' | 'EACCES' | 'EROFS' | null;
  /** Simulate drain completing after N ms */
  drainAfterMs?: number;
  /** Fake clock for deterministic timing */
  clock?: { now: () => number; advance: (ms: number) => void };
  /** Deterministic random seed */
  randSeed?: number;
  /** Mock fs operations */
  fsMock?: FsMock;
}

export interface FsMock {
  appendFileSync?: (path: string, data: string) => void;
  readdirSync?: (dir: string) => string[];
  statSync?: (path: string) => { size: number; mtimeMs: number };
  existsSync?: (path: string) => boolean;
}

/**
 * Outcome shape for a critical write attempt under adverse conditions.
 * The runtime must produce this for every critical-lane write.
 */
export interface CriticalWriteOutcome {
  /** How long the write waited for queue space (ms) */
  waitedMs: number;
  /** Whether synchronous fallback was used */
  usedSyncFallback: boolean;
  /** Whether the entry was re-enqueued after a drain */
  reEnqueuedAfterDrain: boolean;
  /** Whether the append was ultimately committed to disk */
  appendCommitted: boolean;
}

/**
 * Health status shape for fail-safe assertions.
 */
export interface FailSafeStatus {
  health: 'ok' | 'degraded' | 'critical';
  alert: string | null;
  rollbackTriggered: boolean;
}

/**
 * Create a fake clock for deterministic time control in tests.
 */
export function createFakeClock(startMs = 0) {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

/**
 * Create a minimal fs mock that records calls.
 */
export function createRecordingFsMock() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  return {
    calls,
    appendFileSync(path: string, data: string) {
      calls.push({ method: 'appendFileSync', args: [path, data] });
    },
    readdirSync(dir: string) {
      calls.push({ method: 'readdirSync', args: [dir] });
      return [] as string[];
    },
    statSync(path: string) {
      calls.push({ method: 'statSync', args: [path] });
      return { size: 0, mtimeMs: Date.now() };
    },
    existsSync(path: string) {
      calls.push({ method: 'existsSync', args: [path] });
      return false;
    },
  };
}

/**
 * Create an fs mock that throws the specified errno on appendFileSync.
 */
export function createErrnoFsMock(errno: 'ENOSPC' | 'EACCES' | 'EROFS') {
  return {
    appendFileSync(_path: string, _data: string) {
      const err = new Error(`Mock ${errno}`) as NodeJS.ErrnoException;
      err.code = errno;
      throw err;
    },
    readdirSync() {
      return [] as string[];
    },
    statSync() {
      return { size: 0, mtimeMs: Date.now() };
    },
    existsSync() {
      return false;
    },
  };
}
