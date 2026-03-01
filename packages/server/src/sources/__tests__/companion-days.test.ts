import * as realFs from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs')>();
  return {
    ...real,
    existsSync: vi.fn(real.existsSync),
    readFileSync: vi.fn(real.readFileSync),
  };
});

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { initDatabase } from '../../db/init.js';
import { getCompanionSince } from '../../db/system-queries.js';
import { resolveCompanionSince } from '../companion-days.js';

// Keep a reference to real fs for selective mocking
const realExistsSync = realFs.existsSync;
const realReadFileSync = realFs.readFileSync;

function freshDb() {
  return initDatabase({ dbPath: `/tmp/test-resolve-${Date.now()}-${Math.random().toString(36).slice(2)}.db` });
}

function mockStatFail() {
  (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(new Error('stat failed'));
    },
  );
}

function mockDeviceJson(content: string) {
  vi.mocked(existsSync).mockImplementation(((p: string) => {
    if (typeof p === 'string' && p.includes('device.json')) {
      return true;
    }
    return realExistsSync(p);
  }) as typeof existsSync);
  vi.mocked(readFileSync).mockImplementation(((p: string | URL, enc?: unknown) => {
    if (typeof p === 'string' && p.includes('device.json')) {
      return content;
    }
    return realReadFileSync(p, enc as BufferEncoding);
  }) as typeof readFileSync);
}

function mockNoDeviceJson() {
  vi.mocked(existsSync).mockImplementation(((p: string) => {
    if (typeof p === 'string' && p.includes('device.json')) {
      return false;
    }
    return realExistsSync(p);
  }) as typeof existsSync);
}

function resetFsMocks() {
  vi.mocked(existsSync).mockImplementation(realExistsSync as typeof existsSync);
  vi.mocked(readFileSync).mockImplementation(realReadFileSync as typeof readFileSync);
}

describe('resolveCompanionSince', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFsMocks();
  });

  it('returns cached DB value without touching filesystem', async () => {
    const db = freshDb();
    db.prepare('INSERT INTO kv_meta (key, value) VALUES (?, ?)').run('companion_since', '2026-01-30T04:13:07.000Z');
    vi.mocked(existsSync).mockClear();

    const result = await resolveCompanionSince(db, {
      deviceJsonPath: '/fake/device.json',
      openclawDir: '/fake/.openclaw',
      lifetimeCreatedAt: null,
    });
    expect(result).toBe('2026-01-30T04:13:07.000Z');
    // No filesystem or process IO on cache hit
    const deviceCalls = vi
      .mocked(existsSync)
      .mock.calls.filter((c) => typeof c[0] === 'string' && (c[0] as string).includes('device.json'));
    expect(deviceCalls).toHaveLength(0);
    expect(execFile).not.toHaveBeenCalled();
    db.close();
  });

  it('picks min() across device.json and stat birth time', async () => {
    const db = freshDb();
    mockDeviceJson(JSON.stringify({ createdAtMs: 1769717587259 })); // 2026-01-30
    (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, { stdout: '1768435200\n' }); // 2026-01-15T00:00:00Z
      },
    );
    const result = await resolveCompanionSince(db, {
      deviceJsonPath: '/fake/device.json',
      openclawDir: '/fake/.openclaw',
      lifetimeCreatedAt: null,
    });
    expect(result).toBe('2026-01-15T00:00:00.000Z');
    expect(getCompanionSince(db)).toBe('2026-01-15T00:00:00.000Z');
    db.close();
  });

  it('includes lifetimeCreatedAt in min() calculation', async () => {
    const db = freshDb();
    mockDeviceJson(JSON.stringify({ createdAtMs: 1769717587259 })); // 2026-01-30
    mockStatFail();
    const result = await resolveCompanionSince(db, {
      deviceJsonPath: '/fake/device.json',
      openclawDir: '/fake/.openclaw',
      lifetimeCreatedAt: '2026-01-20T00:00:00.000Z',
    });
    expect(result).toBe('2026-01-20T00:00:00.000Z');
    db.close();
  });

  it('bootstraps from device.json alone and persists', async () => {
    const db = freshDb();
    mockDeviceJson(JSON.stringify({ createdAtMs: 1769717587259 }));
    mockStatFail();
    const result = await resolveCompanionSince(db, {
      deviceJsonPath: '/fake/device.json',
      openclawDir: '/fake/.openclaw',
      lifetimeCreatedAt: null,
    });
    expect(result).toBe('2026-01-29T20:13:07.259Z');
    expect(getCompanionSince(db)).toBe('2026-01-29T20:13:07.259Z');
    db.close();
  });

  it('handles corrupt device.json gracefully', async () => {
    const db = freshDb();
    mockDeviceJson('NOT VALID JSON {{{');
    mockStatFail();
    const result = await resolveCompanionSince(db, {
      deviceJsonPath: '/fake/device.json',
      openclawDir: '/fake/.openclaw',
      lifetimeCreatedAt: null,
    });
    expect(result).toBeNull();
    expect(getCompanionSince(db)).toBeNull();
    db.close();
  });

  it('handles device.json with missing createdAtMs field', async () => {
    const db = freshDb();
    mockDeviceJson(JSON.stringify({ version: 1 }));
    mockStatFail();
    const result = await resolveCompanionSince(db, {
      deviceJsonPath: '/fake/device.json',
      openclawDir: '/fake/.openclaw',
      lifetimeCreatedAt: null,
    });
    expect(result).toBeNull();
    db.close();
  });

  it('returns null when all sources fail', async () => {
    const db = freshDb();
    mockNoDeviceJson();
    mockStatFail();
    const result = await resolveCompanionSince(db, {
      deviceJsonPath: '/fake/device.json',
      openclawDir: '/fake/.openclaw',
      lifetimeCreatedAt: null,
    });
    expect(result).toBeNull();
    expect(getCompanionSince(db)).toBeNull();
    db.close();
  });

  it('does not overwrite DB value on second call', async () => {
    const db = freshDb();
    mockDeviceJson(JSON.stringify({ createdAtMs: 1769717587259 }));
    mockStatFail();
    await resolveCompanionSince(db, {
      deviceJsonPath: '/fake/device.json',
      openclawDir: '/fake/.openclaw',
      lifetimeCreatedAt: null,
    });

    mockDeviceJson(JSON.stringify({ createdAtMs: 9999999999999 }));
    const result = await resolveCompanionSince(db, {
      deviceJsonPath: '/fake/device.json',
      openclawDir: '/fake/.openclaw',
      lifetimeCreatedAt: null,
    });
    expect(result).toBe('2026-01-29T20:13:07.259Z');
    db.close();
  });
});
