import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { initDatabase } from '../../../db/init';
import { SessionReader } from '../session-reader';

const tmpDir = join(tmpdir(), 'sr-br-test-' + Date.now());
const tmpFile = join(tmpDir, 'sessions.json');

function writeSessions(data: Record<string, unknown>) {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(tmpFile, JSON.stringify(data));
}

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('SessionReader branches', () => {
  it('infers DONE status for sessions older than 24h', () => {
    writeSessions({
      'agent:main:old': {
        sessionId: 'o1',
        updatedAt: Date.now() - 25 * 60 * 60 * 1000,
        chatType: 'direct',
      },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getSessions()[0].status).toBe('DONE');
    reader.destroy();
  });

  it('infers IDLE status for sessions between 30min and 24h', () => {
    writeSessions({
      'agent:main:idle': {
        sessionId: 'i1',
        updatedAt: Date.now() - 2 * 60 * 60 * 1000,
        chatType: 'direct',
      },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getSessions()[0].status).toBe('IDLE');
    reader.destroy();
  });

  it('uses displayName when available', () => {
    writeSessions({
      'agent:main:x': {
        sessionId: 'x1',
        updatedAt: Date.now(),
        chatType: 'direct',
        displayName: 'Alice',
      },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getSessions()[0].displayName).toBe('Alice');
    reader.destroy();
  });

  it('uses label when displayName is absent', () => {
    writeSessions({
      'agent:main:x': {
        sessionId: 'x1',
        updatedAt: Date.now(),
        chatType: 'direct',
        label: 'My Label',
      },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getSessions()[0].displayName).toBe('My Label');
    reader.destroy();
  });

  it('infers subagent display name for UUID key', () => {
    writeSessions({
      'agent:main:subagent:abcdef01-2345-6789-abcd-ef0123456789': {
        sessionId: 'u1',
        updatedAt: Date.now(),
        chatType: null,
      },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getSessions()[0].displayName).toBe('subagent:abcdef01');
    reader.destroy();
  });

  it('infers slack display name', () => {
    writeSessions({
      'agent:main:slack:channel:C12345': {
        sessionId: 's1',
        updatedAt: Date.now(),
        chatType: 'group',
      },
    });
    const reader = new SessionReader(tmpFile);
    const session = reader.getSessions()[0];
    expect(session.displayName).toBe('slack:channel:C12345');
    reader.destroy();
  });

  it('uses lastChannel when origin.provider is absent', () => {
    writeSessions({
      'agent:main:x': {
        sessionId: 'x1',
        updatedAt: Date.now(),
        chatType: 'direct',
        lastChannel: 'telegram',
      },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getSessions()[0].channel).toBe('telegram');
    reader.destroy();
  });

  it('channel is null when both origin and lastChannel are absent', () => {
    writeSessions({
      'agent:main:x': {
        sessionId: 'x1',
        updatedAt: Date.now(),
        chatType: 'direct',
      },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getSessions()[0].channel).toBeNull();
    reader.destroy();
  });

  it('defaults model to unknown when absent', () => {
    writeSessions({
      'agent:main:x': {
        sessionId: 'x1',
        updatedAt: Date.now(),
        chatType: 'direct',
      },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getSessions()[0].model).toBe('unknown');
    reader.destroy();
  });

  it('attachSubAgents merges spawnedBy and parentChildMap', () => {
    writeSessions({
      'agent:main:parent': {
        sessionId: 'p1',
        updatedAt: Date.now(),
        chatType: 'direct',
      },
      'agent:main:child-spawn': {
        sessionId: 'c1',
        updatedAt: Date.now(),
        chatType: null,
        spawnedBy: 'agent:main:parent',
      },
      'agent:main:child-tracker': {
        sessionId: 'c2',
        updatedAt: Date.now(),
        chatType: null,
      },
    });
    const reader = new SessionReader(tmpFile);
    reader.attachSubAgents(new Map([['agent:main:parent', ['agent:main:child-tracker']]]));
    const parent = reader.getSession('agent:main:parent');
    expect(parent!.subAgents.length).toBe(2);
    // Children should be excluded from getSessions
    const sessions = reader.getSessions();
    expect(sessions.length).toBe(1);
    reader.destroy();
  });

  it('getSessions sorts by NAME', () => {
    writeSessions({
      'agent:main:zeta': { sessionId: 'z', updatedAt: Date.now(), chatType: 'direct' },
      'agent:main:alpha': { sessionId: 'a', updatedAt: Date.now(), chatType: 'direct' },
    });
    const reader = new SessionReader(tmpFile);
    const sessions = reader.getSessions({ sortBy: 'NAME' });
    expect(sessions[0].key).toBe('agent:main:alpha');
    reader.destroy();
  });

  it('getSessions default sort by UPDATED_AT desc', () => {
    writeSessions({
      'agent:main:older': { sessionId: 'o', updatedAt: Date.now() - 1000, chatType: 'direct' },
      'agent:main:newer': { sessionId: 'n', updatedAt: Date.now(), chatType: 'direct' },
    });
    const reader = new SessionReader(tmpFile);
    const sessions = reader.getSessions();
    expect(sessions[0].key).toBe('agent:main:newer');
    reader.destroy();
  });

  it('getTokensByModel aggregates correctly', () => {
    writeSessions({
      'agent:main:a': { sessionId: 'a', updatedAt: Date.now(), chatType: 'direct', model: 'claude', totalTokens: 100 },
      'agent:main:b': { sessionId: 'b', updatedAt: Date.now(), chatType: 'direct', model: 'claude', totalTokens: 200 },
      'agent:main:c': { sessionId: 'c', updatedAt: Date.now(), chatType: 'direct', model: 'gpt', totalTokens: 50 },
    });
    const reader = new SessionReader(tmpFile);
    const byModel = reader.getTokensByModel();
    expect(byModel.get('claude')).toBe(300);
    expect(byModel.get('gpt')).toBe(50);
    reader.destroy();
  });

  it('getTotalTokensK returns sum in thousands', () => {
    writeSessions({
      'agent:main:a': { sessionId: 'a', updatedAt: Date.now(), chatType: 'direct', totalTokens: 1000 },
      'agent:main:b': { sessionId: 'b', updatedAt: Date.now(), chatType: 'direct', totalTokens: 2000 },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getTotalTokensK()).toBe(3);
    reader.destroy();
  });

  it('attachSubAgents skips non-existent parent in parentChildMap', () => {
    writeSessions({
      'agent:main:child': { sessionId: 'c', updatedAt: Date.now(), chatType: 'direct' },
    });
    const reader = new SessionReader(tmpFile);
    reader.attachSubAgents(new Map([['agent:main:nonexistent-parent', ['agent:main:child']]]));
    // Should not throw; child is in attachedChildKeys but parent doesn't exist
    const sessions = reader.getSessions();
    expect(sessions.length).toBe(0); // child filtered out since it's in attachedChildKeys
    reader.destroy();
  });

  it('attachSubAgents deduplicates children from spawnedBy and parentChildMap', () => {
    writeSessions({
      'agent:main:parent': { sessionId: 'p', updatedAt: Date.now(), chatType: 'direct' },
      'agent:main:child': { sessionId: 'c', updatedAt: Date.now(), chatType: null, spawnedBy: 'agent:main:parent' },
    });
    const reader = new SessionReader(tmpFile);
    // Same child from both spawnedBy and parentChildMap
    reader.attachSubAgents(new Map([['agent:main:parent', ['agent:main:child']]]));
    const parent = reader.getSession('agent:main:parent');
    expect(parent!.subAgents.length).toBe(1); // deduped
    reader.destroy();
  });

  it('refreshTurnCounts is no-op without db', () => {
    writeSessions({});
    const reader = new SessionReader(tmpFile);
    reader.refreshTurnCounts(); // Should not throw
    reader.destroy();
  });

  it('refreshTurnCounts populates turn counts from db (L126-139)', () => {
    writeSessions({
      'agent:main:s1': { sessionId: 's1', updatedAt: Date.now(), chatType: 'direct' },
      'agent:main:s2': { sessionId: 's2', updatedAt: Date.now(), chatType: 'direct' },
    });
    const reader = new SessionReader(tmpFile);

    // Create file-based temp DB (initDatabase creates schema with migrations)
    const dbPath = join(tmpdir(), `sr-test-${Date.now()}.db`);
    const db = initDatabase(dbPath);
    // Use a past timestamp to avoid race with refreshTurnCounts' exclusive upper bound (timestamp < endTs)
    const ts = new Date(Date.now() - 1000).toISOString();
    db.prepare('INSERT INTO message_events (timestamp, session_key, role, content_hash) VALUES (?, ?, ?, ?)').run(
      ts,
      'agent:main:s1',
      'user',
      `h1-${Date.now()}`,
    );
    db.prepare('INSERT INTO message_events (timestamp, session_key, role, content_hash) VALUES (?, ?, ?, ?)').run(
      ts,
      'agent:main:s1',
      'assistant',
      `h2-${Date.now()}`,
    );

    reader.setDb(db);
    reader.refreshTurnCounts();

    const sessions = reader.getSessions();
    const s1 = sessions.find((s) => s.key === 'agent:main:s1');
    const s2 = sessions.find((s) => s.key === 'agent:main:s2');
    expect(s1).toBeDefined();
    expect(s1!.turnCount).toBe(2);
    expect(s2!.turnCount).toBe(0); // no messages → ?? 0 branch

    db.close();
    rmSync(dbPath, { force: true });
    rmSync(dbPath + '-wal', { force: true });
    rmSync(dbPath + '-shm', { force: true });
    reader.destroy();
  });

  it('onChange registers a listener that fires on file change', async () => {
    writeSessions({
      'agent:main:x': { sessionId: 'x', updatedAt: Date.now(), chatType: 'direct' },
    });
    const reader = new SessionReader(tmpFile);
    const fn = vi.fn();
    reader.onChange(fn);

    // Trigger a file change
    writeSessions({
      'agent:main:x': { sessionId: 'x', updatedAt: Date.now(), chatType: 'direct' },
      'agent:main:y': { sessionId: 'y', updatedAt: Date.now(), chatType: 'direct' },
    });

    // Wait for debounced reload
    await new Promise((r) => setTimeout(r, 1500));
    expect(fn).toHaveBeenCalled();
    reader.destroy();
  });

  it('reloads when file changes (watcher/poll)', async () => {
    writeSessions({
      'agent:main:initial': { sessionId: 'i', updatedAt: Date.now(), chatType: 'direct' },
    });
    const reader = new SessionReader(tmpFile);
    expect(reader.getSessions().length).toBe(1);

    // Write updated sessions
    writeSessions({
      'agent:main:initial': { sessionId: 'i', updatedAt: Date.now(), chatType: 'direct' },
      'agent:main:new': { sessionId: 'n', updatedAt: Date.now(), chatType: 'direct' },
    });

    // Wait for fs.watch + 300ms debounce; retry for poll fallback (5s interval)
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (reader.getSessions().length === 2) {
        break;
      }
    }
    expect(reader.getSessions().length).toBe(2);
    reader.destroy();
  });

  it('handles UPDATED_AT sort explicitly', () => {
    writeSessions({
      'agent:main:old': { sessionId: 'o', updatedAt: Date.now() - 5000, chatType: 'direct' },
      'agent:main:new': { sessionId: 'n', updatedAt: Date.now(), chatType: 'direct' },
    });
    const reader = new SessionReader(tmpFile);
    const sessions = reader.getSessions({ sortBy: 'UPDATED_AT' });
    expect(sessions[0].key).toBe('agent:main:new');
    reader.destroy();
  });
});
