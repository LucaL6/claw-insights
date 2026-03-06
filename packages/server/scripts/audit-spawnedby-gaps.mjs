#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_SESSIONS_PATH = path.join(os.homedir(), '.openclaw/agents/main/sessions/sessions.json');

/** @typedef {Record<string, unknown>} JsonRecord */

/**
 * @param {unknown} value
 * @returns {value is JsonRecord}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {string} sessionKey
 * @param {JsonRecord} session
 * @returns {boolean}
 */
function isSubagentSession(sessionKey, session) {
  return session.isSubAgent === true || sessionKey.includes(':subagent:');
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function toTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }

    const asDate = Date.parse(value);
    if (Number.isFinite(asDate)) {
      return asDate;
    }
  }

  return Number.NEGATIVE_INFINITY;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeSpawnedBy(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @param {string[]} argv
 * @returns {{ sessionsPath: string, json: boolean, minCoverage: number | null }}
 */
function parseArgs(argv) {
  let sessionsPath = process.env.CLAW_INSIGHTS_SESSIONS_PATH || DEFAULT_SESSIONS_PATH;
  let json = false;
  /** @type {number | null} */
  let minCoverage = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--sessions') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--sessions requires a value');
      }
      sessionsPath = next;
      i += 1;
      continue;
    }

    if (arg === '--json') {
      json = true;
      continue;
    }

    if (arg === '--min-coverage') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--min-coverage requires a value');
      }
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new Error(`--min-coverage must be a number in [0, 100], got: ${next}`);
      }
      minCoverage = parsed;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    sessionsPath,
    json,
    minCoverage,
  };
}

async function main() {
  /** @type {{ sessionsPath: string, json: boolean, minCoverage: number | null }} */
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[audit:spawnedby-gaps] ERROR: ${message}`);
    process.exit(1);
  }

  const sessionsPath = path.resolve(args.sessionsPath);

  /** @type {string} */
  let raw;
  try {
    raw = await readFile(sessionsPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[audit:spawnedby-gaps] ERROR: failed to read ${sessionsPath}: ${message}`);
    process.exit(1);
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[audit:spawnedby-gaps] ERROR: failed to parse JSON in ${sessionsPath}: ${message}`);
    process.exit(1);
  }

  if (!isRecord(parsed)) {
    console.error('[audit:spawnedby-gaps] ERROR: sessions.json must be an object keyed by session key');
    process.exit(1);
  }

  const entries = Object.entries(parsed).filter(([, value]) => isRecord(value));
  const totalSessions = entries.length;

  const subagentEntries = entries.filter(([sessionKey, session]) => isSubagentSession(sessionKey, /** @type {JsonRecord} */ (session)));
  const subagentSessions = subagentEntries.length;

  const withSpawnedBy = subagentEntries.filter(([, session]) => normalizeSpawnedBy((/** @type {JsonRecord} */ (session)).spawnedBy));
  const subagentWithSpawnedBy = withSpawnedBy.length;

  const missing = subagentEntries
    .filter(([, session]) => !normalizeSpawnedBy((/** @type {JsonRecord} */ (session)).spawnedBy))
    .sort((a, b) => {
      const aUpdated = toTimestamp((/** @type {JsonRecord} */ (a[1])).updatedAt);
      const bUpdated = toTimestamp((/** @type {JsonRecord} */ (b[1])).updatedAt);
      return bUpdated - aUpdated;
    });

  const missingCount = missing.length;
  const coverage = subagentSessions === 0 ? 100 : (subagentWithSpawnedBy / subagentSessions) * 100;

  const report = {
    sessionsPath,
    totalSessions,
    subagentSessions,
    subagentWithSpawnedBy,
    subagentMissingSpawnedBy: missingCount,
    coverage,
    coverageText: `${coverage.toFixed(2)}%`,
    missingExamples: missing.slice(0, 10).map(([sessionKey, session]) => {
      const entry = /** @type {JsonRecord} */ (session);
      return {
        sessionKey,
        sessionId: typeof entry.sessionId === 'string' ? entry.sessionId : null,
        updatedAt: entry.updatedAt ?? null,
      };
    }),
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('[audit:spawnedby-gaps] summary');
    console.log(`  sessionsPath=${report.sessionsPath}`);
    console.log(`  sessions.total=${report.totalSessions}`);
    console.log(`  sessions.subagent=${report.subagentSessions}`);
    console.log(`  sessions.subagentWithSpawnedBy=${report.subagentWithSpawnedBy}`);
    console.log(`  sessions.subagentMissingSpawnedBy=${report.subagentMissingSpawnedBy}`);
    console.log(`  coverage=${report.coverageText}`);

    if (report.missingExamples.length > 0) {
      console.log('[audit:spawnedby-gaps] missing examples (up to 10, most recent first)');
      for (const example of report.missingExamples) {
        console.log(`  - ${example.sessionKey} (sessionId=${String(example.sessionId ?? 'unknown')}, updatedAt=${String(example.updatedAt ?? 'unknown')})`);
      }
    }
  }

  if (args.minCoverage !== null && coverage < args.minCoverage) {
    console.error(
      `[audit:spawnedby-gaps] FAIL: coverage ${coverage.toFixed(2)}% is below required ${args.minCoverage.toFixed(2)}%`,
    );
    process.exit(1);
  }
}

main();
