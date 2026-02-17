import { readFileSync, watch, statSync, type FSWatcher } from 'fs';
import { dirname, basename } from 'path';
import type { Session, SessionStatus } from '@claw-insights/shared';
import { emitChange } from '../events.js';
import { config } from '../config.js';

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
  label?: string;
  spawnedBy?: string;
  lastChannel?: string;
}

const SESSIONS_PATH = config.sessionsPath;

function inferStatus(raw: RawSession): SessionStatus {
  const age = Date.now() - raw.updatedAt;
  if (age < 30 * 60 * 1000) return 'ACTIVE';
  if (age < 24 * 60 * 60 * 1000) return 'IDLE';
  return 'DONE';
}

function inferKind(key: string, raw: RawSession): string {
  if (key.includes(':cron:')) return 'cron';
  if (raw.chatType === 'group') return 'group';
  return 'direct';
}

function inferDisplayName(key: string, raw: RawSession): string {
  // Use explicit session label if available (sub-agents get this from spawn)
  if (raw.label) return raw.label;
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
    subAgents: [],
  };
}

export class SessionReader {
  private sessions: Map<string, Session> = new Map();
  private rawSessions: Map<string, RawSession> = new Map();
  private attachedChildKeys: Set<string> = new Set();
  private watcher: FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<() => void> = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private filePath: string = SESSIONS_PATH) {
    this.reload();
    this.startWatching();
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
    } catch (err) {
      console.error('[SessionReader] Failed to read sessions:', err instanceof Error ? err.message : err);
    }
  }

  private scheduleReload() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.reload();
      for (const fn of this.listeners) fn();
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
        if (filename === targetName) this.scheduleReload();
      });
    } catch {
      // Directory might not exist yet
    }

    // Fallback: poll file mtime every 5s in case watcher misses events
    let lastMtime = 0;
    try { lastMtime = statSync(this.filePath).mtimeMs; } catch { /* ignore */ }
    this.pollTimer = setInterval(() => {
      try {
        const mtime = statSync(this.filePath).mtimeMs;
        if (mtime > lastMtime) {
          lastMtime = mtime;
          this.scheduleReload();
        }
      } catch { /* file may not exist */ }
    }, 5_000);
  }

  getSessions(filter?: { activeOnly?: boolean; sortBy?: string }): Session[] {
    let result = Array.from(this.sessions.values())
      .filter(s => !this.attachedChildKeys.has(s.key));
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

  /** Attach sub-agents using both SpawnTracker map AND session.spawnedBy field */
  attachSubAgents(parentChildMap: Map<string, string[]>) {
    // First: use spawnedBy field from raw sessions (always available)
    const bySpawn = new Map<string, string[]>();
    for (const [key] of this.sessions) {
      const raw = this.rawSessions.get(key);
      if (raw?.spawnedBy) {
        const parent = raw.spawnedBy;
        if (!bySpawn.has(parent)) bySpawn.set(parent, []);
        bySpawn.get(parent)!.push(key);
      }
    }

    // Merge spawnTracker map
    for (const [p, children] of parentChildMap) {
      if (!bySpawn.has(p)) bySpawn.set(p, []);
      for (const c of children) {
        if (!bySpawn.get(p)!.includes(c)) bySpawn.get(p)!.push(c);
      }
    }

    // Reset all subAgents first
    for (const s of this.sessions.values()) s.subAgents = [];

    // Attach
    for (const [parentKey, childKeys] of bySpawn) {
      const parent = this.sessions.get(parentKey);
      if (!parent) continue;
      parent.subAgents = childKeys
        .map((ck) => this.sessions.get(ck))
        .filter((s): s is Session => s != null);
    }

    // Record which keys are attached as children
    this.attachedChildKeys = new Set(
      [...bySpawn.values()].flat()
    );
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

  destroy() {
    this.watcher?.close();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.listeners = [];
  }
}
