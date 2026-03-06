/**
 * Tests for SessionReader SpawnBus compatibility hook.
 * Hierarchy authority is sessions.json spawnedBy (SpawnBus is non-authoritative).
 */
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpawnBus } from '../../../events/spawn-bus.js';
import { SessionReader } from '../session-reader.js';

const tmpDir = join(tmpdir(), 'session-reader-spawnbus-test-' + Date.now());
const tmpFile = join(tmpDir, 'sessions.json');

function writeSessions(data: Record<string, unknown>) {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(tmpFile, JSON.stringify(data));
}

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('SessionReader SpawnBus compatibility', () => {
  let reader: SessionReader;
  let spawnBus: SpawnBus;

  beforeEach(() => {
    writeSessions({
      'agent:main:parent1': {
        sessionId: 'p1',
        updatedAt: Date.now(),
        chatType: 'direct',
        model: 'claude-opus-4-6',
        totalTokens: 1000,
        contextTokens: 200000,
      },
      'agent:main:subagent:child1': {
        sessionId: 'c1',
        updatedAt: Date.now(),
        chatType: 'direct',
        model: 'claude-opus-4-6',
        totalTokens: 500,
        contextTokens: 200000,
      },
    });
    reader = new SessionReader(tmpFile, { sessionHierarchyMode: 'dual' });
    spawnBus = new SpawnBus();
  });

  afterEach(() => {
    reader.destroy();
  });

  describe('setSpawnBus', () => {
    it('subscribes to spawn:link events in dual mode (compatibility)', () => {
      const onLinkSpy = vi.spyOn(spawnBus, 'onLink');
      reader.setSpawnBus(spawnBus);
      expect(onLinkSpy).toHaveBeenCalledTimes(1);
    });

    it('does not subscribe in single mode', () => {
      const localReader = new SessionReader(tmpFile, { sessionHierarchyMode: 'single' });
      const localBus = new SpawnBus();
      const onLinkSpy = vi.spyOn(localBus, 'onLink');

      localReader.setSpawnBus(localBus);

      expect(onLinkSpy).not.toHaveBeenCalled();
      localReader.destroy();
    });
  });

  it('keeps hierarchy strictly from spawnedBy even when SpawnBus emits links (dual mode)', () => {
    reader.setSpawnBus(spawnBus);
    spawnBus.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:child1' });

    const parent = reader.getSession('agent:main:parent1');
    expect(parent?.subAgents).toHaveLength(0);

    const topLevelKeys = reader
      .getSessions()
      .map((s) => s.key)
      .sort();
    expect(topLevelKeys).toEqual(['agent:main:parent1', 'agent:main:subagent:child1']);
  });

  it('keeps spawnedBy hierarchy correct without any SpawnBus configured', () => {
    writeSessions({
      'agent:main:parent1': {
        sessionId: 'p1',
        updatedAt: Date.now(),
        chatType: 'direct',
        model: 'claude-opus-4-6',
        totalTokens: 1000,
        contextTokens: 200000,
      },
      'agent:main:subagent:child1': {
        sessionId: 'c1',
        updatedAt: Date.now(),
        chatType: 'direct',
        model: 'claude-opus-4-6',
        totalTokens: 500,
        contextTokens: 200000,
        spawnedBy: 'agent:main:parent1',
      },
    });

    const localReader = new SessionReader(tmpFile, { sessionHierarchyMode: 'single' });
    const parent = localReader.getSession('agent:main:parent1');
    expect(parent?.subAgents.map((s) => s.key)).toEqual(['agent:main:subagent:child1']);
    expect(localReader.getSessions().map((s) => s.key)).toEqual(['agent:main:parent1']);
    localReader.destroy();
  });

  it('does not persist event links across reload because events are non-authoritative', () => {
    reader.setSpawnBus(spawnBus);
    spawnBus.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:child1' });

    writeSessions({
      'agent:main:parent1': {
        sessionId: 'p1',
        updatedAt: Date.now(),
        chatType: 'direct',
        model: 'claude-opus-4-6',
        totalTokens: 2000,
        contextTokens: 200000,
      },
      'agent:main:subagent:child1': {
        sessionId: 'c1',
        updatedAt: Date.now(),
        chatType: 'direct',
        model: 'claude-opus-4-6',
        totalTokens: 500,
        contextTokens: 200000,
      },
    });

    (reader as any).reload();

    const parent = reader.getSession('agent:main:parent1');
    expect(parent?.subAgents).toHaveLength(0);
    expect(parent?.totalTokens).toBe(2000);
  });
});
