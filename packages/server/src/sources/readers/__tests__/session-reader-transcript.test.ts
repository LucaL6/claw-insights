import { mkdtempSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { SessionReader } from '../session-reader.js';

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UUID2 = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'sr-test-'));
}

function writeSessionsJson(dir: string, sessions: Record<string, unknown>): string {
  const p = join(dir, 'sessions.json');
  writeFileSync(p, JSON.stringify(sessions));
  return p;
}

function makeReader(dir: string, sessions: Record<string, unknown>): SessionReader {
  const p = writeSessionsJson(dir, sessions);
  return new SessionReader(p);
}

describe('SessionReader.getTranscriptPath', () => {
  const readers: SessionReader[] = [];
  const mr = (dir: string, s: Record<string, unknown>) => {
    const r = makeReader(dir, s);
    readers.push(r);
    return r;
  };

  afterEach(() => {
    for (const r of readers) {
      r.destroy();
    }
    readers.length = 0;
  });

  it('returns correct path for valid sessionKey', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, `${UUID}.jsonl`), '{}');
    const reader = mr(dir, { 'agent:main:test': { sessionId: UUID, updatedAt: Date.now(), chatType: null } });
    const result = reader.getTranscriptPath('agent:main:test');
    expect(result).toBe(join(dir, `${UUID}.jsonl`));
  });

  it('returns null for unknown sessionKey', () => {
    const dir = makeTempDir();
    const reader = mr(dir, { 'agent:main:test': { sessionId: UUID, updatedAt: Date.now(), chatType: null } });
    expect(reader.getTranscriptPath('nonexistent')).toBeNull();
  });

  it('returns null for invalid UUID format', () => {
    const dir = makeTempDir();
    const reader = mr(dir, {
      'agent:main:test': { sessionId: '../../etc/passwd', updatedAt: Date.now(), chatType: null },
    });
    expect(reader.getTranscriptPath('agent:main:test')).toBeNull();
  });

  it('returns null when no .jsonl file exists', () => {
    const dir = makeTempDir();
    const reader = mr(dir, { 'agent:main:test': { sessionId: UUID, updatedAt: Date.now(), chatType: null } });
    expect(reader.getTranscriptPath('agent:main:test')).toBeNull();
  });

  it('skips .deleted files', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, `${UUID}.jsonl.deleted`), '{}');
    const reader = mr(dir, { 'agent:main:test': { sessionId: UUID, updatedAt: Date.now(), chatType: null } });
    expect(reader.getTranscriptPath('agent:main:test')).toBeNull();
  });

  it('prefers exact <uuid>.jsonl over topic-suffixed variants', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, `${UUID}.jsonl`), '{}');
    writeFileSync(join(dir, `${UUID}-my-topic.jsonl`), '{}');
    const reader = mr(dir, { 'agent:main:test': { sessionId: UUID, updatedAt: Date.now(), chatType: null } });
    expect(reader.getTranscriptPath('agent:main:test')).toBe(join(dir, `${UUID}.jsonl`));
  });

  it('returns null if symlink escapes directory', () => {
    const dir = makeTempDir();
    const outsideDir = makeTempDir();
    const outsideFile = join(outsideDir, `${UUID2}.jsonl`);
    writeFileSync(outsideFile, '{}');
    symlinkSync(outsideFile, join(dir, `${UUID2}.jsonl`));
    const reader = mr(dir, { 'agent:main:test': { sessionId: UUID2, updatedAt: Date.now(), chatType: null } });
    expect(reader.getTranscriptPath('agent:main:test')).toBeNull();
  });
});
