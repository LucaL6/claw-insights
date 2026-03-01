import type { LogEntry } from '@claw-insights/shared';

import { createChildLogger } from '../../logger.js';

const log = createChildLogger('spawn-tracker');

export class SpawnTracker {
  private runToParent = new Map<string, string>();
  private runToChild = new Map<string, string>();
  private parentToChildren = new Map<string, Set<string>>();

  ingest(entry: LogEntry) {
    const msg = entry.message;
    const runIdMatch = msg.match(/runId[=:]\s*([a-zA-Z0-9-]+)/i);
    const sessionMatch = msg.match(/session(?:Key)?[=:]\s*([\w:-]+)/i);
    if (!runIdMatch) {
      return;
    }
    const runId = runIdMatch[1];

    if (msg.includes('sessions_spawn') && sessionMatch) {
      this.runToParent.set(runId, sessionMatch[1]);
    }
    if ((msg.includes('spawned session') || msg.includes('childSession')) && sessionMatch) {
      this.runToChild.set(runId, sessionMatch[1]);
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
