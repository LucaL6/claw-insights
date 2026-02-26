import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../../../db/init';
import { SystemSampler } from '../metrics-collector';

interface SessionLike {
  key: string;
  status: string;
}

interface SessionReaderLike {
  getSessions(): SessionLike[];
}

function setup() {
  const dbPath = join(tmpdir(), `ss-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase(dbPath);
  return {
    db,
    dbPath,
    cleanup: () => {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-wal', { force: true });
      rmSync(dbPath + '-shm', { force: true });
    },
  };
}

describe('SystemSampler', () => {
  it('should sample active sessions and insert into system_samples', () => {
    const { db, cleanup } = setup();
    const sessionReader: SessionReaderLike = {
      getSessions: () => [
        { key: 'a', status: 'ACTIVE' },
        { key: 'b', status: 'ACTIVE' },
        { key: 'c', status: 'IDLE' },
      ],
    };
    const sampler = new SystemSampler(db, sessionReader, () => ({
      cpu: 5.2,
      memoryMB: 128,
      diskMB: 50,
      sampledAt: '',
    }));

    sampler.sampleFast();

    const rows = db.prepare('SELECT * FROM system_samples').all() as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    expect(rows[0].active_sessions).toBe(2);
    // cpu/memory should be 0 initially (before sampleSlow)
    expect(rows[0].cpu).toBe(0);
    expect(rows[0].memory_mb).toBe(0);
    cleanup();
  });

  it('should carry forward cpu/memory from sampleSlow', async () => {
    const { db, cleanup } = setup();
    const sessionReader: SessionReaderLike = {
      getSessions: () => [
        { key: 'a', status: 'ACTIVE' },
        { key: 'b', status: 'ACTIVE' },
      ],
    };
    const sampler = new SystemSampler(db, sessionReader, () => ({
      cpu: 25.5,
      memoryMB: 512,
      diskMB: 100,
      sampledAt: '',
    }));

    await sampler.sampleSlow();
    sampler.sampleFast();

    const rows = db.prepare('SELECT * FROM system_samples ORDER BY id DESC LIMIT 1').all() as Record<string, unknown>[];
    expect(rows[0].cpu).toBe(25.5);
    expect(rows[0].memory_mb).toBe(512);
    expect(rows[0].active_sessions).toBe(2);
    cleanup();
  });

  it('sampleSlow only updates cpu/memory, does not insert a sample', async () => {
    const { db, cleanup } = setup();
    const sessionReader: SessionReaderLike = {
      getSessions: () => [],
    };
    const sampler = new SystemSampler(db, sessionReader, () => ({ cpu: 10, memoryMB: 256, diskMB: 50, sampledAt: '' }));

    await sampler.sampleSlow();

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM system_samples').get() as { cnt: number }).cnt;
    expect(count).toBe(0);
    cleanup();
  });

  it('should not have token-related properties', () => {
    const { db, cleanup } = setup();
    const sampler = new SystemSampler(db, { getSessions: () => [] }, () => ({
      cpu: 0,
      memoryMB: 0,
      diskMB: 0,
      sampledAt: '',
    }));

    const obj = sampler as unknown as Record<string, unknown>;
    expect(obj.prevTotalTokensK).toBeUndefined();
    expect(obj.prevModelTokensK).toBeUndefined();
    expect(obj.lastCostToday).toBeUndefined();
    expect(obj.lastTokensTodayM).toBeUndefined();
    expect(obj.lastTotalTokensK).toBeUndefined();
    cleanup();
  });

  it('should start and stop timers', () => {
    const { db, cleanup } = setup();
    const sampler = new SystemSampler(db, { getSessions: () => [] }, () => ({
      cpu: 0,
      memoryMB: 0,
      diskMB: 0,
      sampledAt: '',
    }));

    sampler.start();
    sampler.stop();
    expect(true).toBe(true);
    cleanup();
  });

  it('sampleFast calls aggregator.clearCache when provided', () => {
    const { db, cleanup } = setup();
    let cleared = false;
    const sampler = new SystemSampler(
      db,
      { getSessions: () => [] },
      () => ({ cpu: 0, memoryMB: 0, diskMB: 0, sampledAt: '' }),
      {
        clearCache: () => {
          cleared = true;
        },
      },
    );

    sampler.sampleFast();
    expect(cleared).toBe(true);
    cleanup();
  });

  it('multiple sampleFast calls insert multiple rows', () => {
    const { db, cleanup } = setup();
    const sampler = new SystemSampler(db, { getSessions: () => [{ key: 'a', status: 'ACTIVE' }] }, () => ({
      cpu: 0,
      memoryMB: 0,
      diskMB: 0,
      sampledAt: '',
    }));

    sampler.sampleFast();
    sampler.sampleFast();
    sampler.sampleFast();

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM system_samples').get() as { cnt: number }).cnt;
    expect(count).toBe(3);
    cleanup();
  });
});
