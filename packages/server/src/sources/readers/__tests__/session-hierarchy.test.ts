import type { Session } from '@claw-insights/shared';
import { describe, expect, it } from 'vitest';

import { buildBaseHierarchyFromSpawnedBy, materializeSubAgents } from '../session-hierarchy';

function createSession(key: string): Session {
  return {
    key,
    displayName: key,
    kind: 'direct',
    model: 'unknown',
    channel: null,
    totalTokens: 0,
    contextTokens: 200_000,
    usagePercent: 0,
    status: 'ACTIVE',
    updatedAt: Date.now(),
    turnCount: 0,
    subAgents: [],
  };
}

describe('session-hierarchy', () => {
  it('builds parent->children from spawnedBy', () => {
    const parentKey = 'agent:main:schema_claw-insights';
    const childKey = 'agent:main:subagent:1892aaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const sessions = new Map<string, Session>([
      [parentKey, createSession(parentKey)],
      [childKey, createSession(childKey)],
    ]);

    const rawSessions = new Map<string, { spawnedBy?: string }>([
      [parentKey, {}],
      [childKey, { spawnedBy: parentKey }],
    ]);

    const result = buildBaseHierarchyFromSpawnedBy(rawSessions, sessions);
    expect(result.parentToChildKeys.get(parentKey)).toEqual([childKey]);
    expect(result.attachedChildKeys.has(childKey)).toBe(true);
  });

  it('ignores missing parent so child remains top-level candidate', () => {
    const childKey = 'agent:main:subagent:missing-parent-child';
    const missingParentKey = 'agent:main:missing-parent';

    const sessions = new Map<string, Session>([[childKey, createSession(childKey)]]);

    const rawSessions = new Map<string, { spawnedBy?: string }>([[childKey, { spawnedBy: missingParentKey }]]);

    const result = buildBaseHierarchyFromSpawnedBy(rawSessions, sessions);
    expect(result.parentToChildKeys.size).toBe(0);
    expect(result.attachedChildKeys.has(childKey)).toBe(false);
  });

  it('deduplicates duplicate children during materialization', () => {
    const parentKey = 'agent:main:parent';
    const childKey = 'agent:main:subagent:child';

    const sessions = new Map<string, Session>([
      [parentKey, createSession(parentKey)],
      [childKey, createSession(childKey)],
    ]);

    const materialized = materializeSubAgents(sessions, new Map([[parentKey, [childKey, childKey]]]));

    expect(sessions.get(parentKey)?.subAgents.map((s) => s.key)).toEqual([childKey]);
    expect(materialized.attachedChildKeys.size).toBe(1);
    expect(materialized.attachedChildKeys.has(childKey)).toBe(true);
  });

  it('preserves session map insertion order for deterministic children ordering', () => {
    const parentKey = 'agent:main:parent';
    const childAKey = 'agent:main:subagent:child-a';
    const childBKey = 'agent:main:subagent:child-b';

    // Intentionally different order from rawSessions to ensure deterministic output
    const sessions = new Map<string, Session>([
      [parentKey, createSession(parentKey)],
      [childBKey, createSession(childBKey)],
      [childAKey, createSession(childAKey)],
    ]);

    const rawSessions = new Map<string, { spawnedBy?: string }>([
      [childAKey, { spawnedBy: parentKey }],
      [childBKey, { spawnedBy: parentKey }],
      [parentKey, {}],
    ]);

    const result = buildBaseHierarchyFromSpawnedBy(rawSessions, sessions);
    expect(result.parentToChildKeys.get(parentKey)).toEqual([childBKey, childAKey]);
  });
});
