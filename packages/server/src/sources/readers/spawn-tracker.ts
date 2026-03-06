import type { LogEntry } from '@claw-insights/shared';

import type { SpawnBus } from '../../events/spawn-bus.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('spawn-tracker');

const RUN_ID_PATTERNS = [/\brunId\b\s*[=:]\s*"?([a-zA-Z0-9-]+)"?/i] as const;
const SESSION_PATTERNS = [/\bsessionKey\b\s*[=:]\s*"?([\w:-]+)"?/i, /\bsession\b\s*[=:]\s*"?([\w:-]+)"?/i] as const;

function extractFirst(message: string, patterns: readonly RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

function isParentEvent(message: string): boolean {
  return /sessions_spawn/i.test(message);
}

function isChildEvent(message: string): boolean {
  return /spawned session|childSession|spawnedSession/i.test(message);
}

export class SpawnTracker {
  private runToParent = new Map<string, string>();
  private runToChild = new Map<string, string>();
  private parentToChildren = new Map<string, Set<string>>();

  /**
   * spawnBus is optional and used for diagnostics/local tooling only.
   * Runtime hierarchy authority is sessions.json.spawnedBy.
   */
  constructor(private spawnBus?: SpawnBus) {}

  ingest(entry: LogEntry) {
    const msg = entry.message;
    const runId = extractFirst(msg, RUN_ID_PATTERNS);
    if (!runId) {
      return;
    }

    const sessionKey = extractFirst(msg, SESSION_PATTERNS);

    if (isParentEvent(msg) && sessionKey) {
      this.runToParent.set(runId, sessionKey);
    }
    if (isChildEvent(msg) && sessionKey) {
      this.runToChild.set(runId, sessionKey);
    }

    const p = this.runToParent.get(runId);
    const c = this.runToChild.get(runId);
    if (p && c) {
      log.debug({ runId, parent: p, child: c }, 'spawn link detected');
      if (!this.parentToChildren.has(p)) {
        this.parentToChildren.set(p, new Set());
      }
      const children = this.parentToChildren.get(p);
      if (children) {
        children.add(c);
      }
      // Emit event for real-time listeners
      this.spawnBus?.emitLink({ parent: p, child: c });
    }
  }

  prune(maxEntries: number = 500) {
    if (this.runToParent.size <= maxEntries) {
      return;
    }
    log.debug({ size: this.runToParent.size, maxEntries }, 'pruning spawn tracker');

    const keys = [...this.runToParent.keys()];
    for (let i = 0; i < keys.length - maxEntries; i++) {
      this.runToParent.delete(keys[i]);
      this.runToChild.delete(keys[i]);
    }
    // Rebuild parentToChildren from remaining entries
    this.parentToChildren.clear();
    for (const [runId, parent] of this.runToParent) {
      const child = this.runToChild.get(runId);
      if (child) {
        if (!this.parentToChildren.has(parent)) {
          this.parentToChildren.set(parent, new Set());
        }
        const set = this.parentToChildren.get(parent);
        if (set) {
          set.add(child);
        }
      }
    }
  }

  getParentChildMap(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const [p, set] of this.parentToChildren) {
      out.set(p, Array.from(set));
    }
    return out;
  }
}
