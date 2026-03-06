#!/usr/bin/env node

import { copyFile, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
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
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function validateSessionsMap(value) {
  /** @type {string[]} */
  const errors = [];

  if (!isRecord(value)) {
    errors.push('sessions payload must be an object keyed by session key');
    return errors;
  }

  for (const [sessionKey, session] of Object.entries(value)) {
    if (!isRecord(session)) {
      errors.push(`session "${sessionKey}" must be an object`);
      continue;
    }

    const sessionId = session.sessionId;
    if (sessionId !== undefined && sessionId !== null && typeof sessionId !== 'string') {
      errors.push(`session "${sessionKey}" has non-string sessionId`);
    }

    const spawnedBy = session.spawnedBy;
    if (spawnedBy !== undefined && spawnedBy !== null && typeof spawnedBy !== 'string') {
      errors.push(`session "${sessionKey}" has non-string spawnedBy`);
    }
  }

  return errors;
}

/**
 * @param {string[]} argv
 * @returns {{ inputPath: string, sessionsPath: string, json: boolean }}
 */
function parseArgs(argv) {
  /** @type {string | null} */
  let inputPath = null;
  let sessionsPath = process.env.CLAW_INSIGHTS_SESSIONS_PATH || DEFAULT_SESSIONS_PATH;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--input') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--input requires a value');
      }
      inputPath = next;
      i += 1;
      continue;
    }

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

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!inputPath) {
    throw new Error('missing required --input <path>');
  }

  return {
    inputPath,
    sessionsPath,
    json,
  };
}

/**
 * @param {string} filePath
 * @returns {Promise<{ raw: string, parsed: unknown }>}
 */
async function readAndParse(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return { raw, parsed };
}

/**
 * Validate referential integrity: every spawnedBy must point to an existing
 * session key, and no session may reference itself as parent.
 * @param {Record<string, unknown>} sessions
 * @returns {string[]}
 */
function validateSpawnedByIntegrity(sessions) {
  /** @type {string[]} */
  const errors = [];
  const allKeys = new Set(Object.keys(sessions));

  for (const [sessionKey, session] of Object.entries(sessions)) {
    if (!isRecord(session)) continue;
    const parent = normalizeString(session.spawnedBy);
    if (!parent) continue;

    if (parent === sessionKey) {
      errors.push(`session "${sessionKey}" has self-referencing spawnedBy`);
    } else if (!allKeys.has(parent)) {
      errors.push(`session "${sessionKey}" spawnedBy references non-existent parent "${parent}"`);
    }

    if (errors.length >= 20) return errors;
  }

  return errors;
}

/**
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} input
 * @returns {string[]}
 */
function compareKeySets(target, input) {
  /** @type {string[]} */
  const errors = [];

  const targetKeys = new Set(Object.keys(target));
  const inputKeys = new Set(Object.keys(input));

  for (const key of targetKeys) {
    if (!inputKeys.has(key)) {
      errors.push(`input missing session key: ${key}`);
      if (errors.length >= 20) {
        return errors;
      }
    }
  }

  for (const key of inputKeys) {
    if (!targetKeys.has(key)) {
      errors.push(`input has unknown session key: ${key}`);
      if (errors.length >= 20) {
        return errors;
      }
    }
  }

  return errors;
}

/**
 * @returns {string}
 */
function backupSuffix() {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function main() {
  /** @type {ReturnType<typeof parseArgs>} */
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[apply:backfill] ERROR: ${message}`);
    process.exit(1);
  }

  const inputPath = path.resolve(args.inputPath);
  const sessionsPath = path.resolve(args.sessionsPath);

  try {
    await stat(inputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[apply:backfill] ERROR: input file not found (${inputPath}): ${message}`);
    process.exit(1);
  }

  /** @type {unknown} */
  let inputParsed;
  /** @type {unknown} */
  let targetParsed;

  try {
    ({ parsed: inputParsed } = await readAndParse(inputPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[apply:backfill] ERROR: failed reading/parsing input JSON (${inputPath}): ${message}`);
    process.exit(1);
  }

  try {
    ({ parsed: targetParsed } = await readAndParse(sessionsPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[apply:backfill] ERROR: failed reading/parsing target sessions (${sessionsPath}): ${message}`);
    process.exit(1);
  }

  const inputValidationErrors = validateSessionsMap(inputParsed);
  if (inputValidationErrors.length > 0) {
    console.error('[apply:backfill] ERROR: input validation failed');
    for (const error of inputValidationErrors.slice(0, 20)) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const targetValidationErrors = validateSessionsMap(targetParsed);
  if (targetValidationErrors.length > 0) {
    console.error('[apply:backfill] ERROR: target sessions validation failed');
    for (const error of targetValidationErrors.slice(0, 20)) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const keysetErrors = compareKeySets(
    /** @type {Record<string, unknown>} */ (targetParsed),
    /** @type {Record<string, unknown>} */ (inputParsed),
  );
  if (keysetErrors.length > 0) {
    console.error('[apply:backfill] ERROR: key-set mismatch between input and target sessions');
    for (const error of keysetErrors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const integrityErrors = validateSpawnedByIntegrity(
    /** @type {Record<string, unknown>} */ (inputParsed),
  );
  if (integrityErrors.length > 0) {
    console.error('[apply:backfill] ERROR: spawnedBy referential integrity check failed');
    for (const error of integrityErrors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const suffix = backupSuffix();
  const backupPath = `${sessionsPath}.bak.${suffix}`;
  const tempPath = `${sessionsPath}.tmp.${process.pid}.${Date.now()}`;

  let replaced = false;
  let restored = false;

  try {
    await copyFile(sessionsPath, backupPath, fsConstants.COPYFILE_EXCL);

    const payload = `${JSON.stringify(inputParsed, null, 2)}\n`;
    await writeFile(tempPath, payload, 'utf8');
    await rename(tempPath, sessionsPath);
    replaced = true;

    const { parsed: verifyParsed } = await readAndParse(sessionsPath);
    const verifyErrors = validateSessionsMap(verifyParsed);
    if (verifyErrors.length > 0) {
      throw new Error(`post-apply validation failed: ${verifyErrors[0]}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      await unlink(tempPath);
    } catch {
      // best effort cleanup
    }

    if (replaced) {
      try {
        await rename(backupPath, sessionsPath);
        restored = true;
      } catch (restoreError) {
        const restoreMessage = restoreError instanceof Error ? restoreError.message : String(restoreError);
        console.error(`[apply:backfill] ERROR: rollback failed after apply failure: ${restoreMessage}`);
      }
    }

    console.error(`[apply:backfill] ERROR: ${message}`);
    if (restored) {
      console.error('[apply:backfill] rollback: restored original sessions from backup');
    }
    process.exit(1);
  }

  const inputSessions = Object.values(/** @type {Record<string, unknown>} */ (inputParsed))
    .filter((entry) => isRecord(entry))
    .filter((entry) => normalizeString(entry.spawnedBy)).length;

  const report = {
    sessionsPath,
    inputPath,
    backupPath,
    spawnedByNonEmptyCount: inputSessions,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`APPLY_OK sessionsPath=${sessionsPath} backupPath=${backupPath}`);
  }
}

main();
