import type { Session, SessionSortBy, SessionStatus } from '@claw-insights/shared';
import { type FSWatcher, readdirSync, readFileSync, realpathSync, statSync, watch } from 'fs';
import { basename, dirname, join, sep } from 'path';

import { config, type SessionHierarchyMode } from '../../config.js';
import type { Database } from '../../db/database.js';
import { getRangeTurnCountBySession } from '../../db/message-queries.js';
import { emitChange } from '../../events.js';
import type { SpawnBus, SpawnLinkEvent } from '../../events/spawn-bus.js';
import { createChildLogger } from '../../logger.js';
import { buildBaseHierarchyFromSpawnedBy, materializeSubAgents } from './session-hierarchy.js';

const log = createChildLogger('session-reader');

interface RawSession {
  sessionId: string;
  updatedAt: number;
  chatType: string | null;
  model?: string;
  modelProvider?: string;
  totalTokens?: number;
  contextTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  origin?: { provider?: string; label?: string };
  displayName?: string;
  label?: string;
  spawnedBy?: string;
  lastChannel?: string;
}

const SESSIONS_PATH = config.sessionsPath;

function inferStatus(raw: RawSession): SessionStatus {
  const age = Date.now() - raw.updatedAt;
  if (age < 30 * 60 * 1000) {
    return 'ACTIVE';
  }
  if (age < 24 * 60 * 60 * 1000) {
    return 'IDLE';
  }
  return 'DONE';
}

function inferKind(key: string, raw: RawSession): string {
  if (key.includes(':cron:')) {
    return 'cron';
  }
  if (raw.chatType === 'group') {
    return 'group';
  }
  return 'direct';
}

function inferDisplayName(key: string, raw: RawSession): string {
  // Highest priority: gateway-resolved displayName (e.g. Slack/Telegram user name)
  const displayName = raw.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  // Use explicit session label if available (sub-agents get this from spawn)
  const label = raw.label?.trim();
  if (label) {
    return label;
  }
  // Parse key: agent:main:NAME or agent:main:subagent:UUID
  const parts = key.split(':');
  const last = parts[parts.length - 1];
  // If last segment is a UUID, show "subagent:short-uuid"
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(last) && parts.length > 1) {
    return parts[parts.length - 2] + ':' + last.slice(0, 8);
  }
  // For slack:channel:ID or slack:dm:ID, show the last meaningful part
  if (key.includes(':slack:')) {
    const slackIdx = parts.indexOf('slack');
    if (slackIdx >= 0 && slackIdx + 2 < parts.length) {
      return `slack:${parts[slackIdx + 1]}:${parts[slackIdx + 2]}`;
    }
  }
  return last;
}

function inferChannel(raw: RawSession): string | null {
  return raw.origin?.provider ?? raw.lastChannel ?? null;
}

function parseSession(key: string, raw: RawSession): Session {
  const contextTokens = raw.contextTokens ?? 200000;
  const totalTokens = raw.totalTokens ?? 0;
  return {
    key,
    displayName: inferDisplayName(key, raw),
    kind: inferKind(key, raw),
    model: raw.model ?? 'unknown',
    channel: inferChannel(raw),
    totalTokens,
    contextTokens,
    usagePercent: contextTokens > 0 ? Math.round((totalTokens / contextTokens) * 1000) / 10 : 0,
    status: inferStatus(raw),
    updatedAt: raw.updatedAt,
    turnCount: 0,
    subAgents: [],
  };
}

export interface SessionHierarchyParity {
  baseChildCount: number;
  finalChildCount: number;
  overlayOnlyCount: number;
  missingAfterOverlayCount: number;
}

export function computeHierarchyParity(
  baseAttachedChildKeys: Set<string>,
  finalAttachedChildKeys: Set<string>,
): SessionHierarchyParity {
  let overlayOnlyCount = 0;
  for (const childKey of finalAttachedChildKeys) {
    if (!baseAttachedChildKeys.has(childKey)) {
      overlayOnlyCount += 1;
    }
  }

  let missingAfterOverlayCount = 0;
  for (const childKey of baseAttachedChildKeys) {
    if (!finalAttachedChildKeys.has(childKey)) {
      missingAfterOverlayCount += 1;
    }
  }

  return {
    baseChildCount: baseAttachedChildKeys.size,
    finalChildCount: finalAttachedChildKeys.size,
    overlayOnlyCount,
    missingAfterOverlayCount,
  };
}

export class SessionReader {
  private sessions: Map<string, Session> = new Map();
  private rawSessions: Map<string, RawSession> = new Map();
  private attachedChildKeys: Set<string> = new Set();
  private turnCountCache: Map<string, number> = new Map();
  private db: Database | null = null;
  private readonly sessionHierarchyMode: SessionHierarchyMode;
  private watcher: FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<() => void> = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // SpawnBus diagnostics hook (non-authoritative for hierarchy)
  private unsubSpawn?: () => void;

  /** Inject DB reference for turn count queries */
  setDb(db: Database): void {
    this.db = db;
  }

  /** Refresh turn count cache from DB */
  refreshTurnCounts(): void {
    if (!this.db) {
      return;
    }
    const rows = getRangeTurnCountBySession(this.db, '1970-01-01T00:00:00.000Z', new Date().toISOString());
    this.turnCountCache.clear();
    for (const r of rows) {
      this.turnCountCache.set(r.sessionKey, r.turns);
    }
    // Update existing sessions
    for (const [key, session] of this.sessions) {
      session.turnCount = this.turnCountCache.get(key) ?? 0;
    }
  }

  /** Called when message events are written — invalidate and refresh */
  invalidateTurnCounts(): void {
    this.refreshTurnCounts();
  }

  constructor(
    private filePath: string = SESSIONS_PATH,
    options: { sessionHierarchyMode?: SessionHierarchyMode } = {},
  ) {
    this.sessionHierarchyMode = options.sessionHierarchyMode ?? config.sessionHierarchyMode;
    this.reload();
    this.startWatching();
  }

  /**
   * Optional diagnostics hook for spawn events.
   *
   * Hierarchy authority is sessions.json.spawnedBy; spawn events are non-authoritative.
   * In current runtime behavior, `single` and `dual` produce identical hierarchy output.
   */
  setSpawnBus(bus: SpawnBus): void {
    // Cleanup previous subscription if exists (safety for rewire/tests)
    this.unsubSpawn?.();

    if (this.sessionHierarchyMode === 'single') {
      this.unsubSpawn = undefined;
      return;
    }

    // `dual` path is retained as compatibility/diagnostics-only subscription.
    this.unsubSpawn = bus.onLink(this.onSpawnLink.bind(this));
  }

  private onSpawnLink({ parent, child }: SpawnLinkEvent): void {
    log.debug({ parent, child }, 'received spawn link event (non-authoritative)');
  }

  private rebuildFromSpawnedByBase(): void {
    for (const session of this.sessions.values()) {
      session.subAgents = [];
    }
    this.attachedChildKeys.clear();

    const { parentToChildKeys } = buildBaseHierarchyFromSpawnedBy(this.rawSessions, this.sessions);
    const { attachedChildKeys } = materializeSubAgents(this.sessions, parentToChildKeys);
    this.attachedChildKeys = attachedChildKeys;
  }

  private reload() {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Record<string, RawSession>;
      this.sessions.clear();
      this.rawSessions.clear();
      for (const [key, entry] of Object.entries(raw)) {
        this.rawSessions.set(key, entry);
        this.sessions.set(key, parseSession(key, entry));
      }
      this.refreshTurnCounts();
      // Deterministic hierarchy authority from sessions.json spawnedBy
      this.rebuildFromSpawnedByBase();
    } catch (err) {
      log.error({ err }, 'failed to read sessions');
    }
  }

  private scheduleReload() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.reload();
      for (const fn of this.listeners) {
        fn();
      }
      emitChange('sessions');
    }, 300);
  }

  private startWatching() {
    const targetName = basename(this.filePath);
    const dir = dirname(this.filePath);

    // Primary: watch the directory (reliable on macOS where file-level
    // fs.watch can silently miss in-place writes to large files)
    try {
      this.watcher = watch(dir, (_event, filename) => {
        if (filename === targetName) {
          this.scheduleReload();
        }
      });
    } catch {
      // Directory might not exist yet
    }

    // Fallback: poll file mtime every 5s in case watcher misses events
    let lastMtime = 0;
    try {
      lastMtime = statSync(this.filePath).mtimeMs;
    } catch {
      /* ignore */
    }
    this.pollTimer = setInterval(() => {
      try {
        const mtime = statSync(this.filePath).mtimeMs;
        if (mtime > lastMtime) {
          lastMtime = mtime;
          this.scheduleReload();
        }
      } catch {
        /* file may not exist */
      }
    }, 5_000);
  }

  getSessions(filter?: { activeOnly?: boolean; sortBy?: SessionSortBy }): Session[] {
    let result = Array.from(this.sessions.values()).filter((s) => !this.attachedChildKeys.has(s.key));
    if (filter?.activeOnly) {
      result = result.filter((s) => s.status === 'ACTIVE');
    }
    switch (filter?.sortBy) {
      case 'TOKENS_DESC':
        result.sort((a, b) => b.totalTokens - a.totalTokens);
        break;
      case 'NAME':
        result.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      case 'UPDATED_AT':
      default:
        result.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return result;
  }

  getSession(key: string): Session | undefined {
    return this.sessions.get(key);
  }

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  /**
   * Compatibility hook retained for callers/tests.
   *
   * @deprecated parentChildMap is ignored; hierarchy authority is strictly
   * sessions.json.spawnedBy.
   */
  attachSubAgents(_parentChildMap: Map<string, string[]>) {
    this.rebuildFromSpawnedByBase();
  }

  getSessionIdToKeyMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const [key, raw] of this.rawSessions) {
      if (raw.sessionId) {
        map.set(raw.sessionId, key);
      }
    }
    return map;
  }

  /** Full token stats by model (bypasses dedup filter) */
  getTokensByModel(): Map<string, number> {
    const result = new Map<string, number>();
    for (const session of this.sessions.values()) {
      const model = session.model || 'unknown';
      result.set(model, (result.get(model) ?? 0) + session.totalTokens);
    }
    return result;
  }

  /** Full total tokens in K (bypasses dedup filter) */
  getTotalTokensK(): number {
    let total = 0;
    for (const session of this.sessions.values()) {
      total += session.totalTokens;
    }
    return total / 1000;
  }

  getTranscriptPath(sessionKey: string): string | null {
    const raw = this.rawSessions.get(sessionKey);
    if (!raw?.sessionId) {
      return null;
    }

    const sessionId = raw.sessionId;

    // UUID format validation (prevent injection)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sessionId)) {
      return null;
    }

    const transcriptsDir = dirname(this.filePath);

    let files: string[];
    try {
      files = readdirSync(transcriptsDir).filter(
        (f) => f.startsWith(sessionId) && f.endsWith('.jsonl') && !f.includes('.deleted'),
      );
    } catch {
      return null;
    }

    if (files.length === 0) {
      return null;
    }

    if (files.length > 1) {
      log.warn({ sessionId, files }, 'multiple transcript files match session');
    }

    const exactMatch = files.find((f) => f === `${sessionId}.jsonl`);
    const target = exactMatch ?? files.sort()[0];
    const fullPath = join(transcriptsDir, target);

    // Path traversal defense
    try {
      const realDir = realpathSync(transcriptsDir);
      const realFile = realpathSync(fullPath);
      if (!realFile.startsWith(realDir + sep)) {
        return null;
      }
    } catch {
      return null;
    }

    return fullPath;
  }

  destroy() {
    this.unsubSpawn?.();
    this.watcher?.close();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.listeners = [];
  }
}
