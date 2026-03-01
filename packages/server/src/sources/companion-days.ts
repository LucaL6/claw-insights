import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';

import type { Database } from '../db/database.js';
import { getCompanionSince, setCompanionSince } from '../db/system-queries.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('companion-days');

const execFileAsync = promisify(execFile);

export interface CompanionOpts {
  deviceJsonPath: string;
  openclawDir: string;
  /** ISO timestamp from LifetimeScanner.createdAt (reuses its transcript logic) */
  lifetimeCreatedAt: string | null;
}

/**
 * Resolve the companion_since timestamp (the moment the user first installed OpenClaw).
 *
 * Strategy: collect ALL available timestamps, pick min() (the earliest).
 * Sources:
 *   1. DB kv_meta (already persisted — instant return)
 *   2. device.json createdAtMs
 *   3. ~/.openclaw directory birth time (macOS stat -f "%B")
 *   4. LifetimeScanner.createdAt (device.json + earliest transcript, already computed)
 *
 * Once resolved, persists to DB so subsequent calls are O(1).
 * Returns null only if ALL sources fail.
 */
export async function resolveCompanionSince(db: Database, opts: CompanionOpts): Promise<string | null> {
  // 1. Check DB cache — if persisted, return immediately
  const cached = getCompanionSince(db);
  if (cached) {
    return cached;
  }

  // 2. Collect all candidate timestamps (ms since epoch)
  const candidates: number[] = [];

  // 2a. device.json
  const deviceMs = readDeviceCreatedAt(opts.deviceJsonPath);
  if (deviceMs !== null) {
    candidates.push(deviceMs);
  }

  // 2b. Directory birth time (macOS)
  const statMs = await statBirthTimeMs(opts.openclawDir);
  if (statMs !== null) {
    candidates.push(statMs);
  }

  // 2c. LifetimeScanner result (reuse, don't duplicate)
  if (opts.lifetimeCreatedAt) {
    const ltMs = new Date(opts.lifetimeCreatedAt).getTime();
    if (!isNaN(ltMs) && ltMs > 0) {
      candidates.push(ltMs);
    }
  }

  // 3. Pick the earliest
  if (candidates.length === 0) {
    log.warn('no candidate timestamps found for companion_since');
    return null;
  }

  const earliest = new Date(Math.min(...candidates)).toISOString();
  setCompanionSince(db, earliest);
  log.debug({ candidateCount: candidates.length, earliest }, 'companion_since resolved');
  return earliest;
}

function readDeviceCreatedAt(path: string): number | null {
  try {
    if (!existsSync(path)) {
      return null;
    }
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    if (typeof data.createdAtMs === 'number' && data.createdAtMs > 0) {
      return data.createdAtMs;
    }
  } catch {
    // corrupt or unreadable — gracefully skip
  }
  return null;
}

async function statBirthTimeMs(dir: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('stat', ['-f', '%B', dir], {
      timeout: 2000,
      encoding: 'utf-8',
    });
    const epoch = parseInt(stdout.trim(), 10);
    if (!isNaN(epoch) && epoch > 0) {
      return epoch * 1000;
    }
  } catch {
    // Not macOS or stat failed
  }
  return null;
}
