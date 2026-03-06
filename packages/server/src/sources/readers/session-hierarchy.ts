import type { Session } from '@claw-insights/shared';

interface RawSessionLike {
  spawnedBy?: string;
}

export interface BaseHierarchyBuildResult {
  parentToChildKeys: Map<string, string[]>;
  attachedChildKeys: Set<string>;
}

export interface MaterializedHierarchyResult {
  attachedChildKeys: Set<string>;
}

/**
 * Build deterministic base hierarchy from sessions.json spawnedBy links.
 * Child ordering follows session map insertion order for stable output.
 */
export function buildBaseHierarchyFromSpawnedBy(
  rawSessions: Map<string, RawSessionLike>,
  sessions: Map<string, Session>,
): BaseHierarchyBuildResult {
  const parentToChildKeys = new Map<string, string[]>();
  const attachedChildKeys = new Set<string>();
  /** Track seen children per parent for O(1) dedup instead of O(n) includes */
  const seenByParent = new Map<string, Set<string>>();

  for (const childKey of sessions.keys()) {
    const parentKey = rawSessions.get(childKey)?.spawnedBy;
    if (!parentKey) {
      continue;
    }
    if (!sessions.has(parentKey)) {
      continue;
    }

    let childKeys = parentToChildKeys.get(parentKey);
    let seen = seenByParent.get(parentKey);
    if (!childKeys) {
      childKeys = [];
      parentToChildKeys.set(parentKey, childKeys);
    }
    if (!seen) {
      seen = new Set(childKeys);
      seenByParent.set(parentKey, seen);
    }

    if (!seen.has(childKey)) {
      seen.add(childKey);
      childKeys.push(childKey);
      attachedChildKeys.add(childKey);
    }
  }

  return { parentToChildKeys, attachedChildKeys };
}

/**
 * Materialize parent -> subAgents arrays from prepared parent/child key map.
 */
export function materializeSubAgents(
  sessions: Map<string, Session>,
  parentToChildKeys: Map<string, string[]>,
): MaterializedHierarchyResult {
  const attachedChildKeys = new Set<string>();

  for (const [parentKey, childKeys] of parentToChildKeys) {
    const parentSession = sessions.get(parentKey);
    if (!parentSession) {
      continue;
    }

    const nextChildren: Session[] = [];
    const seen = new Set<string>();

    for (const childKey of childKeys) {
      if (seen.has(childKey)) {
        continue;
      }
      seen.add(childKey);

      const childSession = sessions.get(childKey);
      if (!childSession) {
        continue;
      }

      nextChildren.push(childSession);
      attachedChildKeys.add(childKey);
    }

    parentSession.subAgents = nextChildren;
  }

  return { attachedChildKeys };
}
