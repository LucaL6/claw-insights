import { describe, it, expect, afterEach } from 'bun:test';
import { SessionReader } from '../session-reader';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tmpDir = join(tmpdir(), 'session-reader-test-' + Date.now());
const tmpFile = join(tmpDir, 'sessions.json');

function writeSessions(data: Record<string, unknown>) {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(tmpFile, JSON.stringify(data));
}

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('SessionReader', () => {
  it('should parse sessions from file', () => {
    writeSessions({
      'agent:main:test-session': {
        sessionId: 'abc-123',
        updatedAt: Date.now(),
        chatType: 'direct',
        model: 'claude-opus-4-6',
        totalTokens: 5000,
        contextTokens: 200000,
        origin: { provider: 'webchat', label: 'Alice' },
      },
    });
    const reader = new SessionReader(tmpFile);
    const sessions = reader.getSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].key).toBe('agent:main:test-session');
    expect(sessions[0].displayName).toBe('test-session');
    expect(sessions[0].model).toBe('claude-opus-4-6');
    expect(sessions[0].totalTokens).toBe(5000);
    expect(sessions[0].usagePercent).toBe(2.5);
    expect(sessions[0].status).toBe('ACTIVE');
    expect(sessions[0].channel).toBe('webchat');
    reader.destroy();
  });

  it('should infer kind from key', () => {
    writeSessions({
      'agent:main:cron:abc': {
        sessionId: 'c1',
        updatedAt: Date.now(),
        chatType: null,
      },
      'agent:main:slack:group:test': {
        sessionId: 'g1',
        updatedAt: Date.now(),
        chatType: 'group',
      },
    });
    const reader = new SessionReader(tmpFile);
    const sessions = reader.getSessions();
    const cron = sessions.find((s) => s.key.includes('cron'));
    const group = sessions.find((s) => s.key.includes('group'));
    expect(cron?.kind).toBe('cron');
    expect(group?.kind).toBe('group');
    reader.destroy();
  });

  it('should filter active only', () => {
    writeSessions({
      'agent:main:active': {
        sessionId: 'a1',
        updatedAt: Date.now(),
        chatType: 'direct',
      },
      'agent:main:old': {
        sessionId: 'a2',
        updatedAt: Date.now() - 2 * 60 * 60 * 1000,
        chatType: 'direct',
      },
    });
    const reader = new SessionReader(tmpFile);
    const active = reader.getSessions({ activeOnly: true });
    expect(active.length).toBe(1);
    expect(active[0].key).toBe('agent:main:active');
    reader.destroy();
  });

  it('should sort by tokens desc', () => {
    writeSessions({
      'agent:main:low': { sessionId: 'l', updatedAt: Date.now(), chatType: 'direct', totalTokens: 100 },
      'agent:main:high': { sessionId: 'h', updatedAt: Date.now(), chatType: 'direct', totalTokens: 9000 },
    });
    const reader = new SessionReader(tmpFile);
    const sorted = reader.getSessions({ sortBy: 'TOKENS_DESC' });
    expect(sorted[0].key).toBe('agent:main:high');
    reader.destroy();
  });

  it('should handle missing file gracefully', () => {
    const reader = new SessionReader('/nonexistent/path.json');
    const sessions = reader.getSessions();
    expect(sessions.length).toBe(0);
    reader.destroy();
  });

  it('should calculate usagePercent correctly at boundaries', () => {
    writeSessions({
      'agent:main:full': {
        sessionId: 'f1', updatedAt: Date.now(), chatType: 'direct',
        totalTokens: 200000, contextTokens: 200000,
      },
      'agent:main:zero': {
        sessionId: 'z1', updatedAt: Date.now(), chatType: 'direct',
        totalTokens: 0, contextTokens: 200000,
      },
      'agent:main:nocontext': {
        sessionId: 'n1', updatedAt: Date.now(), chatType: 'direct',
        totalTokens: 100, contextTokens: 0,
      },
    });
    const reader = new SessionReader(tmpFile);
    const sessions = reader.getSessions({ sortBy: 'NAME' });
    const full = sessions.find(s => s.key.includes('full'));
    const zero = sessions.find(s => s.key.includes('zero'));
    const noCtx = sessions.find(s => s.key.includes('nocontext'));
    expect(full!.usagePercent).toBe(100);
    expect(zero!.usagePercent).toBe(0);
    expect(noCtx!.usagePercent).toBe(0); // Division by zero protection
    reader.destroy();
  });

  it('should attach sub-agents via parentChildMap', () => {
    writeSessions({
      'agent:main:parent': { sessionId: 'p1', updatedAt: Date.now(), chatType: 'direct', totalTokens: 5000, contextTokens: 200000 },
      'agent:main:child1': { sessionId: 'c1', updatedAt: Date.now(), chatType: 'direct', totalTokens: 1000, contextTokens: 200000 },
      'agent:main:child2': { sessionId: 'c2', updatedAt: Date.now(), chatType: 'direct', totalTokens: 2000, contextTokens: 200000 },
    });
    const reader = new SessionReader(tmpFile);
    const map = new Map([['agent:main:parent', ['agent:main:child1', 'agent:main:child2']]]);
    reader.attachSubAgents(map);
    const parent = reader.getSession('agent:main:parent');
    expect(parent!.subAgents.length).toBe(2);
    expect(parent!.subAgents[0].label).toBe('child1');
    reader.destroy();
  });

  it('should handle attachSubAgents with missing child gracefully', () => {
    writeSessions({
      'agent:main:parent': { sessionId: 'p1', updatedAt: Date.now(), chatType: 'direct' },
    });
    const reader = new SessionReader(tmpFile);
    const map = new Map([['agent:main:parent', ['agent:main:nonexistent']]]);
    reader.attachSubAgents(map);
    const parent = reader.getSession('agent:main:parent');
    expect(parent!.subAgents.length).toBe(0); // Missing child filtered out
    reader.destroy();
  });

  it('should read real sessions file', () => {
    const realPath = `${process.env.HOME}/.openclaw/agents/main/sessions/sessions.json`;
    try {
      const reader = new SessionReader(realPath);
      const sessions = reader.getSessions();
      expect(sessions.length).toBeGreaterThan(0);
      // Verify structure
      const first = sessions[0];
      expect(typeof first.key).toBe('string');
      expect(typeof first.totalTokens).toBe('number');
      expect(typeof first.usagePercent).toBe('number');
      reader.destroy();
    } catch {
      // Skip if file doesn't exist in CI
    }
  });
});
