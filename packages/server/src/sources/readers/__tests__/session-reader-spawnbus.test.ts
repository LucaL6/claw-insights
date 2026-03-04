/**
 * Tests for SessionReader SpawnBus integration (DESIGN-066)
 * Covers: setSpawnBus, onSpawnLink, pendingLinks, eventLinks, reload persistence
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

describe('SessionReader SpawnBus integration', () => {
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
    reader = new SessionReader(tmpFile);
    spawnBus = new SpawnBus();
  });

  afterEach(() => {
    reader.destroy();
  });

  describe('setSpawnBus', () => {
    it('subscribes to spawn:link events', () => {
      const onLinkSpy = vi.spyOn(spawnBus, 'onLink');
      reader.setSpawnBus(spawnBus);
      expect(onLinkSpy).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes previous handler on re-subscription', () => {
      const bus1 = new SpawnBus();
      const bus2 = new SpawnBus();

      reader.setSpawnBus(bus1);
      reader.setSpawnBus(bus2);

      // Emit on old bus should not affect reader
      bus1.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:child1' });

      const parent = reader.getSession('agent:main:parent1');
      expect(parent?.subAgents).toHaveLength(0); // Not attached via old bus
    });
  });

  describe('onSpawnLink', () => {
    it('attaches immediately when both sessions exist', () => {
      reader.setSpawnBus(spawnBus);
      spawnBus.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:child1' });

      const parent = reader.getSession('agent:main:parent1');
      expect(parent?.subAgents).toHaveLength(1);
      expect(parent?.subAgents[0].key).toBe('agent:main:subagent:child1');
    });

    it('stores in pendingLinks when parent missing', () => {
      reader.setSpawnBus(spawnBus);
      spawnBus.emitLink({ parent: 'agent:main:missing-parent', child: 'agent:main:subagent:child1' });

      const pending = (reader as any).pendingLinks;
      expect(pending.get('agent:main:missing-parent')?.has('agent:main:subagent:child1')).toBe(true);
    });

    it('stores in pendingLinks when child missing', () => {
      reader.setSpawnBus(spawnBus);
      spawnBus.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:missing-child' });

      const pending = (reader as any).pendingLinks;
      expect(pending.get('agent:main:parent1')?.has('agent:main:subagent:missing-child')).toBe(true);
    });

    it('records in eventLinks for reload persistence', () => {
      reader.setSpawnBus(spawnBus);
      spawnBus.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:child1' });

      const eventLinks = (reader as any).eventLinks;
      expect(eventLinks.get('agent:main:parent1')?.has('agent:main:subagent:child1')).toBe(true);
    });

    it('prevents duplicate attachments', () => {
      reader.setSpawnBus(spawnBus);
      spawnBus.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:child1' });
      spawnBus.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:child1' }); // Duplicate

      const parent = reader.getSession('agent:main:parent1');
      expect(parent?.subAgents).toHaveLength(1);
    });
  });

  describe('applyEventLinks after reload', () => {
    it('reapplies event-driven links after file reload', () => {
      reader.setSpawnBus(spawnBus);
      spawnBus.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:child1' });

      // Verify initial attachment
      let parent = reader.getSession('agent:main:parent1');
      expect(parent?.subAgents).toHaveLength(1);

      // Simulate file change and reload
      writeSessions({
        'agent:main:parent1': {
          sessionId: 'p1',
          updatedAt: Date.now(),
          chatType: 'direct',
          model: 'claude-opus-4-6',
          totalTokens: 2000, // Changed
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

      // Force reload
      (reader as any).reload();

      // Verify link persisted after reload
      parent = reader.getSession('agent:main:parent1');
      expect(parent?.subAgents).toHaveLength(1);
      expect(parent?.subAgents[0].key).toBe('agent:main:subagent:child1');
      expect(parent?.totalTokens).toBe(2000); // Confirms reload happened
    });
  });

  describe('destroy cleanup', () => {
    it('unsubscribes from SpawnBus on destroy', () => {
      reader.setSpawnBus(spawnBus);
      reader.destroy();

      // Emit after destroy should not attach
      spawnBus.emitLink({ parent: 'agent:main:parent1', child: 'agent:main:subagent:child1' });

      // Create new reader to check sessions weren't modified
      const reader2 = new SessionReader(tmpFile);
      const parent = reader2.getSession('agent:main:parent1');
      expect(parent?.subAgents).toHaveLength(0);
      reader2.destroy();
    });
  });
});
