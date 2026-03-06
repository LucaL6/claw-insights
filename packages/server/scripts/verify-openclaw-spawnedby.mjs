#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const SESSIONS_PATH =
  process.env.CLAW_INSIGHTS_SESSIONS_PATH ||
  path.join(os.homedir(), '.openclaw/agents/main/sessions/sessions.json');

/**
 * @typedef {Record<string, unknown>} SessionRecord
 */

/**
 * @param {string[]} argv
 * @returns {{ assertLatestSubagent: boolean }}
 */
function parseArgs(argv) {
  return {
    assertLatestSubagent: argv.includes('--assert-latest-subagent'),
  };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, SessionRecord>}
 */
function isSessionMap(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
 * @param {string} sessionKey
 * @param {SessionRecord} session
 * @returns {boolean}
 */
function isSubagentSession(sessionKey, session) {
  const explicit = session.isSubAgent;
  return explicit === true || sessionKey.includes(':subagent:');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  /** @type {string} */
  let raw;
  try {
    raw = await readFile(SESSIONS_PATH, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[verify:spawnedby] ERROR: failed to read ${SESSIONS_PATH}: ${message}`);
    process.exit(1);
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[verify:spawnedby] ERROR: failed to parse JSON in ${SESSIONS_PATH}: ${message}`);
    process.exit(1);
  }

  if (!isSessionMap(parsed)) {
    console.error('[verify:spawnedby] ERROR: sessions.json must be an object keyed by session key');
    process.exit(1);
  }

  const entries = Object.entries(parsed).filter(([, value]) => typeof value === 'object' && value !== null);
  const totalSessions = entries.length;

  const subagentEntries = entries.filter(([sessionKey, session]) => isSubagentSession(sessionKey, /** @type {SessionRecord} */ (session)));
  const subagentSessions = subagentEntries.length;
  const subagentsWithSpawnedBy = subagentEntries.filter(([, session]) => {
    const spawnedBy = /** @type {SessionRecord} */ (session).spawnedBy;
    return typeof spawnedBy === 'string' && spawnedBy.trim().length > 0;
  });
  const subagentWithSpawnedBy = subagentsWithSpawnedBy.length;

  const coverage = subagentSessions === 0 ? 100 : (subagentWithSpawnedBy / subagentSessions) * 100;
  const coveragePercent = `${coverage.toFixed(2)}%`;

  const missing = subagentEntries
    .filter(([, session]) => {
      const spawnedBy = /** @type {SessionRecord} */ (session).spawnedBy;
      return !(typeof spawnedBy === 'string' && spawnedBy.trim().length > 0);
    })
    .sort((a, b) => {
      const aUpdatedAt = toTimestamp((/** @type {SessionRecord} */ (a[1])).updatedAt);
      const bUpdatedAt = toTimestamp((/** @type {SessionRecord} */ (b[1])).updatedAt);
      return bUpdatedAt - aUpdatedAt;
    });

  console.log('[verify:spawnedby] summary');
  console.log(`  sessions.total=${totalSessions}`);
  console.log(`  sessions.subagent=${subagentSessions}`);
  console.log(`  sessions.subagentWithSpawnedBy=${subagentWithSpawnedBy}`);
  console.log(`  coverage=${coveragePercent}`);

  if (missing.length > 0) {
    console.log('[verify:spawnedby] missing examples (up to 5, most recent first)');
    for (const [sessionKey, session] of missing.slice(0, 5)) {
      const updatedAt = /** @type {SessionRecord} */ (session).updatedAt;
      console.log(`  - ${sessionKey} (updatedAt=${String(updatedAt ?? 'unknown')})`);
    }
  } else {
    console.log('[verify:spawnedby] no missing spawnedBy entries found for subagent sessions');
  }

  if (args.assertLatestSubagent) {
    const latestSubagent = subagentEntries
      .slice()
      .sort((a, b) => toTimestamp((/** @type {SessionRecord} */ (b[1])).updatedAt) - toTimestamp((/** @type {SessionRecord} */ (a[1])).updatedAt))[0];

    if (!latestSubagent) {
      console.log('[verify:spawnedby] assert-latest-subagent: no subagent sessions found; skipping assertion');
      return;
    }

    const [latestSessionKey, latestSession] = latestSubagent;
    const spawnedBy = /** @type {SessionRecord} */ (latestSession).spawnedBy;
    const hasSpawnedBy = typeof spawnedBy === 'string' && spawnedBy.trim().length > 0;

    if (!hasSpawnedBy) {
      console.error(`[verify:spawnedby] ERROR: latest subagent missing spawnedBy: ${latestSessionKey}`);
      process.exit(1);
    }

    console.log(`[verify:spawnedby] assert-latest-subagent: PASS (${latestSessionKey} -> ${spawnedBy})`);
  }
}

main();
