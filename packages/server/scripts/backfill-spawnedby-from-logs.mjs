#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const DEFAULT_SESSIONS_PATH = path.join(os.homedir(), '.openclaw/agents/main/sessions/sessions.json');
const DEFAULT_LOGS_SPEC = '/tmp/openclaw/openclaw-*.log';

const RUN_START_RE = /embedded run start:\s*runId=([a-zA-Z0-9-]+)\s+sessionId=([0-9a-f-]{36})/i;
const TOOL_START_RE = /embedded run tool start:\s*runId=([a-zA-Z0-9-]+)\s+tool=([a-zA-Z0-9_.:-]+)/i;
const DIAGNOSTIC_RE = /message processed:.*\bmessageId=([a-zA-Z0-9-]+).*?\bsessionKey=([\w:-]+)/i;
const RUN_ID_RE = /\brunId\b\s*[=:]\s*([a-zA-Z0-9-]+)/i;
const SESSION_KEY_RE = /\bsessionKey\b\s*[=:]\s*"?([\w:-]+)"?/i;
const CHILD_PATTERNS = [
  /\bchildSession\b\s*[=:]\s*"?([\w:-]+)"?/i,
  /\bspawnedSession\b\s*[=:]\s*"?([\w:-]+)"?/i,
  /spawned session[:\s]+"?([\w:-]+)"?/i,
  /\bsession\b\s*[=:]\s*"?([\w:-]*:subagent:[\w-]+)"?/i,
];

/** @typedef {Record<string, unknown>} JsonRecord */

/**
 * @typedef {object} TranscriptHint
 * @property {string | null} sourceSessionKey
 * @property {number | null} startedAtMs
 * @property {string | null} transcriptPath
 * @property {string | null} error
 */

/**
 * @typedef {object} RunInfo
 * @property {string} runId
 * @property {string | null} sessionId
 * @property {string | null} parentSessionKey
 * @property {boolean} hasSessionsSpawn
 * @property {number[]} spawnTimesMs
 * @property {Set<string>} childKeys
 */

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
 * @returns {number | null}
 */
function toTimestampMs(value) {
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

  return null;
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
 * @param {string} value
 * @returns {boolean}
 */
function looksLikeSessionKey(value) {
  return value.includes(':');
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function looksLikeSubagentKey(value) {
  return value.includes(':subagent:');
}

/**
 * @param {string} value
 * @returns {number | null}
 */
function parseIsoMs(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * @param {string} logsSpec
 * @returns {Promise<string[]>}
 */
async function resolveLogFiles(logsSpec) {
  const resolved = path.resolve(logsSpec);

  if (resolved.includes('*')) {
    const dir = path.dirname(resolved);
    const filePattern = path.basename(resolved);

    try {
      const names = await readdir(dir);
      const matcher = wildcardToRegex(filePattern);
      return names
        .filter((name) => matcher.test(name))
        .map((name) => path.join(dir, name))
        .sort();
    } catch {
      return [];
    }
  }

  try {
    const stats = await stat(resolved);
    if (stats.isDirectory()) {
      const names = await readdir(resolved);
      return names
        .filter((name) => name.endsWith('.log'))
        .map((name) => path.join(resolved, name))
        .sort();
    }
    return stats.isFile() ? [resolved] : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} runId
 * @param {Map<string, RunInfo>} runs
 * @returns {RunInfo}
 */
function ensureRun(runId, runs) {
  const existing = runs.get(runId);
  if (existing) {
    return existing;
  }

  const created = {
    runId,
    sessionId: null,
    parentSessionKey: null,
    hasSessionsSpawn: false,
    spawnTimesMs: [],
    childKeys: new Set(),
  };
  runs.set(runId, created);
  return created;
}

/**
 * @param {string} message
 * @returns {string | null}
 */
function extractChildKey(message) {
  for (const pattern of CHILD_PATTERNS) {
    const match = message.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const candidate = match[1].trim();
    if (looksLikeSubagentKey(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * @param {string} message
 * @returns {string | null}
 */
function extractRunId(message) {
  const match = message.match(RUN_ID_RE);
  return match?.[1] ?? null;
}

/**
 * @param {string[]} logFiles
 * @param {Map<string, string>} sessionIdToKey
 * @returns {Promise<{
 *   directCandidates: Map<string, Map<string, number>>,
 *   spawnRuns: Array<{ runId: string, parent: string, timeMs: number }>,
 *   stats: { filesRead: number, linesRead: number, runsObserved: number, spawnRuns: number, directChildLinks: number }
 * }>}
 */
async function parseLogs(logFiles, sessionIdToKey) {
  /** @type {Map<string, RunInfo>} */
  const runs = new Map();

  let linesRead = 0;
  let filesRead = 0;

  for (const logFile of logFiles) {
    filesRead += 1;

    const stream = createReadStream(logFile, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      linesRead += 1;
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      /** @type {unknown} */
      let raw;
      try {
        raw = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!isRecord(raw)) {
        continue;
      }

      const message =
        (typeof raw['1'] === 'string' && raw['1']) ||
        (typeof raw['0'] === 'string' && raw['0']) ||
        '';
      if (!message) {
        continue;
      }

      const timeMs = typeof raw.time === 'string' ? parseIsoMs(raw.time) : null;

      const runStartMatch = message.match(RUN_START_RE);
      if (runStartMatch?.[1] && runStartMatch[2]) {
        const run = ensureRun(runStartMatch[1], runs);
        run.sessionId = runStartMatch[2];
      }

      const toolStartMatch = message.match(TOOL_START_RE);
      if (toolStartMatch?.[1] && toolStartMatch[2]) {
        const run = ensureRun(toolStartMatch[1], runs);
        if (toolStartMatch[2] === 'sessions_spawn') {
          run.hasSessionsSpawn = true;
          if (timeMs !== null) {
            run.spawnTimesMs.push(timeMs);
          }
        }
      }

      const diagnosticMatch = message.match(DIAGNOSTIC_RE);
      if (diagnosticMatch?.[1] && diagnosticMatch[2]) {
        const run = ensureRun(diagnosticMatch[1], runs);
        run.parentSessionKey = diagnosticMatch[2];
      }

      const runId = extractRunId(message);
      if (!runId) {
        continue;
      }

      const run = ensureRun(runId, runs);

      if (!run.parentSessionKey) {
        const sessionKeyMatch = message.match(SESSION_KEY_RE);
        const sessionKey = sessionKeyMatch?.[1] ?? null;
        if (sessionKey && looksLikeSessionKey(sessionKey) && !looksLikeSubagentKey(sessionKey)) {
          run.parentSessionKey = sessionKey;
        }
      }

      const childKey = extractChildKey(message);
      if (childKey) {
        run.childKeys.add(childKey);
      }
    }
  }

  /** @type {Map<string, Map<string, number>>} */
  const directCandidates = new Map();
  /** @type {Array<{ runId: string, parent: string, timeMs: number }>} */
  const spawnRuns = [];
  let directChildLinks = 0;

  for (const run of runs.values()) {
    if (!run.hasSessionsSpawn) {
      continue;
    }

    const parent = run.parentSessionKey || (run.sessionId ? sessionIdToKey.get(run.sessionId) ?? null : null);
    if (!parent || !looksLikeSessionKey(parent)) {
      continue;
    }

    for (const spawnTime of run.spawnTimesMs) {
      spawnRuns.push({ runId: run.runId, parent, timeMs: spawnTime });
    }

    for (const child of run.childKeys) {
      if (!directCandidates.has(child)) {
        directCandidates.set(child, new Map());
      }
      const parentCounts = directCandidates.get(child);
      if (parentCounts) {
        const current = parentCounts.get(parent) ?? 0;
        parentCounts.set(parent, current + 1);
        directChildLinks += 1;
      }
    }
  }

  return {
    directCandidates,
    spawnRuns,
    stats: {
      filesRead,
      linesRead,
      runsObserved: runs.size,
      spawnRuns: spawnRuns.length,
      directChildLinks,
    },
  };
}

/**
 * @param {string} sessionId
 * @param {string} transcriptsDir
 * @param {number} maxLines
 * @returns {Promise<TranscriptHint>}
 */
async function readTranscriptHint(sessionId, transcriptsDir, maxLines) {
  const transcriptPath = path.join(transcriptsDir, `${sessionId}.jsonl`);

  try {
    await stat(transcriptPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      sourceSessionKey: null,
      startedAtMs: null,
      transcriptPath,
      error: `missing transcript (${message})`,
    };
  }

  /** @type {Map<string, { count: number, firstLine: number }>} */
  const sourceCounts = new Map();
  /** @type {number | null} */
  let startedAtMs = null;
  let lineNo = 0;

  const stream = createReadStream(transcriptPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      lineNo += 1;
      if (lineNo > maxLines) {
        break;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      /** @type {unknown} */
      let raw;
      try {
        raw = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (!isRecord(raw)) {
        continue;
      }

      if (startedAtMs === null && raw.type === 'session') {
        const ts = typeof raw.timestamp === 'string' ? parseIsoMs(raw.timestamp) : null;
        if (ts !== null) {
          startedAtMs = ts;
        }
      }

      if (raw.type !== 'message' || !isRecord(raw.message)) {
        continue;
      }

      const provenance = isRecord(raw.message.provenance) ? raw.message.provenance : null;
      const sourceSessionKey = provenance ? normalizeString(provenance.sourceSessionKey) : null;
      if (!sourceSessionKey) {
        continue;
      }

      const previous = sourceCounts.get(sourceSessionKey);
      if (previous) {
        previous.count += 1;
      } else {
        sourceCounts.set(sourceSessionKey, { count: 1, firstLine: lineNo });
      }
    }
  } finally {
    rl.close();
  }

  let bestSource = null;
  let bestCount = -1;
  let bestFirstLine = Number.POSITIVE_INFINITY;

  for (const [candidate, info] of sourceCounts) {
    if (info.count > bestCount || (info.count === bestCount && info.firstLine < bestFirstLine)) {
      bestSource = candidate;
      bestCount = info.count;
      bestFirstLine = info.firstLine;
    }
  }

  return {
    sourceSessionKey: bestSource,
    startedAtMs,
    transcriptPath,
    error: null,
  };
}

/**
 * @param {Map<string, number>} counts
 * @returns {string | null}
 */
function pickUniqueParent(counts) {
  if (counts.size !== 1) {
    return null;
  }
  for (const parent of counts.keys()) {
    return parent;
  }
  return null;
}

/**
 * @param {Array<{ runId: string, parent: string, timeMs: number }>} spawnRuns
 * @param {number} childStartedAtMs
 * @param {number} windowMs
 * @returns {{ parent: string, runId: string, deltaMs: number } | null}
 */
function inferParentBySpawnTime(spawnRuns, childStartedAtMs, windowMs) {
  const candidates = spawnRuns
    .map((run) => ({ ...run, deltaMs: Math.abs(run.timeMs - childStartedAtMs) }))
    .filter((run) => run.deltaMs <= windowMs)
    .sort((a, b) => a.deltaMs - b.deltaMs);

  if (candidates.length === 0) {
    return null;
  }

  const uniqueParents = new Set(candidates.map((entry) => entry.parent));
  if (uniqueParents.size !== 1) {
    return null;
  }

  const best = candidates[0];
  return {
    parent: best.parent,
    runId: best.runId,
    deltaMs: best.deltaMs,
  };
}

/**
 * @param {string[]} argv
 * @returns {{
 *   sessionsPath: string,
 *   outputPath: string | null,
 *   logsSpec: string,
 *   transcriptsDir: string | null,
 *   json: boolean,
 *   dryRun: boolean,
 *   maxTranscriptLines: number,
 *   timeWindowMs: number,
 * }}
 */
function parseArgs(argv) {
  let sessionsPath = process.env.CLAW_INSIGHTS_SESSIONS_PATH || DEFAULT_SESSIONS_PATH;
  /** @type {string | null} */
  let outputPath = null;
  let logsSpec = process.env.CLAW_INSIGHTS_LOGS_PATH || DEFAULT_LOGS_SPEC;
  /** @type {string | null} */
  let transcriptsDir = null;
  let json = false;
  let dryRun = false;
  let maxTranscriptLines = 800;
  let timeWindowMs = 120_000;

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

    if (arg === '--output') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--output requires a value');
      }
      outputPath = next;
      i += 1;
      continue;
    }

    if (arg === '--logs') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--logs requires a value');
      }
      logsSpec = next;
      i += 1;
      continue;
    }

    if (arg === '--transcripts') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--transcripts requires a value');
      }
      transcriptsDir = next;
      i += 1;
      continue;
    }

    if (arg === '--max-transcript-lines') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--max-transcript-lines requires a value');
      }
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`--max-transcript-lines must be a positive number, got: ${next}`);
      }
      maxTranscriptLines = Math.floor(parsed);
      i += 1;
      continue;
    }

    if (arg === '--time-window-ms') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('--time-window-ms requires a value');
      }
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`--time-window-ms must be a non-negative number, got: ${next}`);
      }
      timeWindowMs = Math.floor(parsed);
      i += 1;
      continue;
    }

    if (arg === '--json') {
      json = true;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    sessionsPath,
    outputPath,
    logsSpec,
    transcriptsDir,
    json,
    dryRun,
    maxTranscriptLines,
    timeWindowMs,
  };
}

async function main() {
  /** @type {ReturnType<typeof parseArgs>} */
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[backfill:spawnedby] ERROR: ${message}`);
    process.exit(1);
  }

  const sessionsPath = path.resolve(args.sessionsPath);
  const transcriptsDir = path.resolve(args.transcriptsDir || path.dirname(sessionsPath));
  const outputPath = path.resolve(args.outputPath || path.join(path.dirname(sessionsPath), 'sessions.backfilled.json'));

  /** @type {string} */
  let raw;
  try {
    raw = await readFile(sessionsPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[backfill:spawnedby] ERROR: failed to read ${sessionsPath}: ${message}`);
    process.exit(1);
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[backfill:spawnedby] ERROR: failed to parse JSON in ${sessionsPath}: ${message}`);
    process.exit(1);
  }

  if (!isRecord(parsed)) {
    console.error('[backfill:spawnedby] ERROR: sessions.json must be an object keyed by session key');
    process.exit(1);
  }

  const sessionEntries = Object.entries(parsed).filter(([, value]) => isRecord(value));
  const allSessionKeys = new Set(sessionEntries.map(([sessionKey]) => sessionKey));

  /** @type {Map<string, string>} */
  const sessionIdToKey = new Map();
  for (const [sessionKey, value] of sessionEntries) {
    const session = /** @type {JsonRecord} */ (value);
    const sessionId = normalizeString(session.sessionId);
    if (sessionId) {
      sessionIdToKey.set(sessionId, sessionKey);
    }
  }

  const subagentEntries = sessionEntries.filter(([sessionKey, value]) => isSubagentSession(sessionKey, /** @type {JsonRecord} */ (value)));
  const missingEntries = subagentEntries.filter(([, value]) => !normalizeString((/** @type {JsonRecord} */ (value)).spawnedBy));

  const logFiles = await resolveLogFiles(args.logsSpec);
  const logResult = await parseLogs(logFiles, sessionIdToKey);

  /** @type {Map<string, TranscriptHint>} */
  const transcriptHints = new Map();

  /** @type {Map<string, { parent: string, strategy: string, detail: string | null }>} */
  const resolved = new Map();
  /** @type {Array<{ child: string, reason: string, detail: string | null }>} */
  const unresolved = [];

  /** @type {Record<string, number>} */
  const inferredBy = {
    sessionRecord: 0,
    logsDirect: 0,
    logsTimeWindow: 0,
    transcriptProvenance: 0,
  };

  for (const [childSessionKey, value] of missingEntries) {
    const session = /** @type {JsonRecord} */ (value);

    const recordParentHints = [session.parentSessionKey, session.sourceSessionKey]
      .map((rawValue) => normalizeString(rawValue))
      .filter((candidate) => candidate && allSessionKeys.has(candidate));

    if (recordParentHints.length > 0) {
      resolved.set(childSessionKey, {
        parent: /** @type {string} */ (recordParentHints[0]),
        strategy: 'sessionRecord',
        detail: 'parentSessionKey/sourceSessionKey',
      });
      inferredBy.sessionRecord += 1;
      continue;
    }

    const directCounts = logResult.directCandidates.get(childSessionKey) ?? null;
    if (directCounts) {
      const uniqueParent = pickUniqueParent(directCounts);
      if (uniqueParent && allSessionKeys.has(uniqueParent)) {
        resolved.set(childSessionKey, {
          parent: uniqueParent,
          strategy: 'logsDirect',
          detail: `direct log child link (${Array.from(directCounts.values())[0]} hit)` ,
        });
        inferredBy.logsDirect += 1;
        continue;
      }
    }

    const sessionId = normalizeString(session.sessionId);
    /** @type {TranscriptHint | null} */
    let transcriptHint = null;

    if (sessionId) {
      const existingHint = transcriptHints.get(sessionId);
      if (existingHint) {
        transcriptHint = existingHint;
      } else {
        const loadedHint = await readTranscriptHint(sessionId, transcriptsDir, args.maxTranscriptLines);
        transcriptHints.set(sessionId, loadedHint);
        transcriptHint = loadedHint;
      }
    }

    const childStartedAtMs = transcriptHint?.startedAtMs ?? toTimestampMs(session.updatedAt);
    if (childStartedAtMs !== null) {
      const byTime = inferParentBySpawnTime(logResult.spawnRuns, childStartedAtMs, args.timeWindowMs);
      if (byTime && allSessionKeys.has(byTime.parent)) {
        resolved.set(childSessionKey, {
          parent: byTime.parent,
          strategy: 'logsTimeWindow',
          detail: `runId=${byTime.runId} deltaMs=${byTime.deltaMs}`,
        });
        inferredBy.logsTimeWindow += 1;
        continue;
      }
    }

    const transcriptParent = transcriptHint?.sourceSessionKey ?? null;
    if (transcriptParent && allSessionKeys.has(transcriptParent)) {
      resolved.set(childSessionKey, {
        parent: transcriptParent,
        strategy: 'transcriptProvenance',
        detail: transcriptHint?.transcriptPath ?? null,
      });
      inferredBy.transcriptProvenance += 1;
      continue;
    }

    /** @type {string} */
    let unresolvedReason;
    if (!transcriptHint) {
      unresolvedReason = 'no-transcript';
    } else if (transcriptHint.error) {
      unresolvedReason = 'transcript-read-error';
    } else if (!transcriptHint.sourceSessionKey) {
      unresolvedReason = 'no-provenance-in-transcript';
    } else if (!allSessionKeys.has(transcriptHint.sourceSessionKey)) {
      unresolvedReason = 'parent-key-not-in-sessions';
    } else {
      unresolvedReason = 'unknown';
    }

    unresolved.push({
      child: childSessionKey,
      reason: unresolvedReason,
      detail: transcriptHint?.error ?? transcriptHint?.transcriptPath ?? null,
    });
  }

  const beforeCoverage = subagentEntries.length === 0
    ? 100
    : ((subagentEntries.length - missingEntries.length) / subagentEntries.length) * 100;

  /** @type {Record<string, JsonRecord>} */
  const updatedSessions = /** @type {Record<string, JsonRecord>} */ (JSON.parse(JSON.stringify(parsed)));

  for (const [child, hit] of resolved) {
    const current = updatedSessions[child];
    if (!isRecord(current)) {
      continue;
    }
    current.spawnedBy = hit.parent;
  }

  const afterMissing = missingEntries.length - resolved.size;
  const afterCoverage = subagentEntries.length === 0
    ? 100
    : ((subagentEntries.length - afterMissing) / subagentEntries.length) * 100;

  const report = {
    sessionsPath,
    outputPath,
    transcriptsDir,
    logsSpec: args.logsSpec,
    logsMatchedFiles: logFiles.length,
    logs: logResult.stats,
    subagentSessions: subagentEntries.length,
    missingBefore: missingEntries.length,
    backfilled: resolved.size,
    missingAfter: afterMissing,
    coverageBefore: Number(beforeCoverage.toFixed(2)),
    coverageAfter: Number(afterCoverage.toFixed(2)),
    inferredBy,
    resolvedExamples: Array.from(resolved.entries()).slice(0, 20).map(([child, hit]) => ({
      child,
      parent: hit.parent,
      strategy: hit.strategy,
      detail: hit.detail,
    })),
    unresolvedExamples: unresolved.slice(0, 20),
    wroteOutput: !args.dryRun,
  };

  if (!args.dryRun) {
    try {
      await writeFile(outputPath, `${JSON.stringify(updatedSessions, null, 2)}\n`, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[backfill:spawnedby] ERROR: failed to write ${outputPath}: ${message}`);
      process.exit(1);
    }
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('[backfill:spawnedby] summary');
    console.log(`  sessionsPath=${report.sessionsPath}`);
    console.log(`  outputPath=${report.outputPath}`);
    console.log(`  logsSpec=${report.logsSpec}`);
    console.log(`  logs.matchedFiles=${report.logsMatchedFiles}`);
    console.log(`  logs.linesRead=${report.logs.linesRead}`);
    console.log(`  sessions.subagent=${report.subagentSessions}`);
    console.log(`  sessions.missingBefore=${report.missingBefore}`);
    console.log(`  sessions.backfilled=${report.backfilled}`);
    console.log(`  sessions.missingAfter=${report.missingAfter}`);
    console.log(`  coverage.before=${report.coverageBefore.toFixed(2)}%`);
    console.log(`  coverage.after=${report.coverageAfter.toFixed(2)}%`);
    console.log(`  inferredBy.sessionRecord=${report.inferredBy.sessionRecord}`);
    console.log(`  inferredBy.logsDirect=${report.inferredBy.logsDirect}`);
    console.log(`  inferredBy.logsTimeWindow=${report.inferredBy.logsTimeWindow}`);
    console.log(`  inferredBy.transcriptProvenance=${report.inferredBy.transcriptProvenance}`);

    if (report.wroteOutput) {
      console.log(`  wrote=${report.outputPath}`);
    } else {
      console.log('  wrote=skipped (--dry-run)');
    }

    if (report.resolvedExamples.length > 0) {
      console.log('[backfill:spawnedby] resolved examples');
      for (const item of report.resolvedExamples) {
        console.log(`  - ${item.child} <- ${item.parent} (${item.strategy}${item.detail ? `; ${item.detail}` : ''})`);
      }
    }

    if (report.unresolvedExamples.length > 0) {
      console.log('[backfill:spawnedby] unresolved examples');
      for (const item of report.unresolvedExamples) {
        console.log(`  - ${item.child} (${item.reason}${item.detail ? `; ${item.detail}` : ''})`);
      }
    }
  }
}

main();
