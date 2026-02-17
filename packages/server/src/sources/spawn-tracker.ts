import type { LogEntry } from '@claw-insights/shared';

export class SpawnTracker {
  private runToParent = new Map<string, string>();
  private runToChild = new Map<string, string>();
  private parentToChildren = new Map<string, Set<string>>();

  ingest(entry: LogEntry) {
    const msg = entry.message;
    const runIdMatch = msg.match(/runId[=:]\s*([a-zA-Z0-9-]+)/i);
    const sessionMatch = msg.match(/session(?:Key)?[=:]\s*([\w:-]+)/i);
    if (!runIdMatch) return;
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
      if (!this.parentToChildren.has(p)) this.parentToChildren.set(p, new Set());
      this.parentToChildren.get(p)!.add(c);
    }
  }

  getParentChildMap(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const [p, set] of this.parentToChildren) out.set(p, Array.from(set));
    return out;
  }
}
