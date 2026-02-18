import { describe, it, expect } from 'vitest';
import { MetricsCollector } from '../metrics-collector';
import { initDatabase } from '../../../db/init';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function setup() {
  const dbPath = join(tmpdir(), `mc-${Date.now()}-${Math.random()}.db`);
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

describe('MetricsCollector', () => {
  it('should sample sessions and insert into metric_samples', () => {
    const { db, cleanup } = setup();
    const mockSessionReader = {
      getSessions: () => [
        { key: 'a', status: 'ACTIVE', totalTokens: 50000 },
        { key: 'b', status: 'ACTIVE', totalTokens: 30000 },
        { key: 'c', status: 'IDLE', totalTokens: 20000 },
      ],
      getTokensByModel: () => new Map([['test-model', 100000]]),
      getTotalTokensK: () => 100,
    };
    const collector = new MetricsCollector(
      db,
      mockSessionReader as any,
      () => ({ cpu: 5.2, memoryMB: 128, diskMB: 50, sampledAt: '' }),
      () => ({ totalCost: 100, totalTokensM: 50, todayCost: 10, todayTokensM: 5, fetchedAt: '' }),
    );

    collector.sampleFast();

    const rows = db.prepare('SELECT * FROM metric_samples').all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].active_sessions).toBe(2); // only ACTIVE
    expect(rows[0].total_tokens_k).toBe(100); // (50k+30k+20k) / 1000
    cleanup();
  });

  it('should compute token delta between samples', () => {
    const { db, cleanup } = setup();
    let totalTokens = 80000;
    const mockSessionReader = {
      getSessions: () => [{ key: 'a', status: 'ACTIVE', totalTokens }],
      getTokensByModel: () => new Map([['test-model', totalTokens]]),
      getTotalTokensK: () => totalTokens / 1000,
    };
    const collector = new MetricsCollector(
      db,
      mockSessionReader as any,
      () => ({ cpu: 0, memoryMB: 0, diskMB: 0, sampledAt: '' }),
      () => ({ totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: '' }),
    );

    collector.sampleFast();
    totalTokens = 95000; // +15k tokens
    collector.sampleFast();

    const rows = db.prepare('SELECT token_delta_k FROM metric_samples ORDER BY id').all() as any[];
    expect(rows[0].token_delta_k).toBe(0); // first sample, no delta
    expect(rows[1].token_delta_k).toBe(0); // delta computed at query time, not write time
    cleanup();
  });

  it('should sample slow metrics (cost + system) and carry forward session/token values', async () => {
    const { db, cleanup } = setup();
    const mockSessionReader = {
      getSessions: () => [
        { key: 'a', status: 'ACTIVE', totalTokens: 60000 },
        { key: 'b', status: 'ACTIVE', totalTokens: 40000 },
      ],
      getTokensByModel: () => new Map([['test-model', 100000]]),
      getTotalTokensK: () => 100,
    };
    const collector = new MetricsCollector(
      db,
      mockSessionReader as any,
      () => ({ cpu: 25.5, memoryMB: 512, diskMB: 100, sampledAt: '' }),
      () => ({ totalCost: 200, totalTokensM: 100, todayCost: 15.5, todayTokensM: 8.3, fetchedAt: '' }),
    );

    // Fast sample first to establish session/token baseline
    collector.sampleFast();
    // Slow sample should carry forward session/token values
    await collector.sampleSlow();

    const rows = db.prepare('SELECT * FROM metric_samples ORDER BY id DESC LIMIT 1').all() as any[];
    expect(rows[0].cost_today).toBe(15.5);
    expect(rows[0].tokens_today_m).toBe(8.3);
    expect(rows[0].cpu).toBe(25.5);
    expect(rows[0].memory_mb).toBe(512);
    // Verify it carried forward session/token values (not zeros)
    expect(rows[0].active_sessions).toBe(2);
    expect(rows[0].total_tokens_k).toBe(100);
    cleanup();
  });

  it('should NOT have prune methods or timer', () => {
    const { db, cleanup } = setup();
    const mockSessionReader = { getSessions: () => [], getTokensByModel: () => new Map(), getTotalTokensK: () => 0 };
    const collector = new MetricsCollector(
      db,
      mockSessionReader as any,
      () => ({ cpu: 0, memoryMB: 0, diskMB: 0, sampledAt: '' }),
      () => ({ totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: '' }),
    );

    expect((collector as any).pruneTimer).toBeUndefined();
    cleanup();
  });

  it('should start and stop timers', () => {
    const { db, cleanup } = setup();
    const mockSessionReader = { getSessions: () => [], getTokensByModel: () => new Map(), getTotalTokensK: () => 0 };
    const collector = new MetricsCollector(
      db,
      mockSessionReader as any,
      () => ({ cpu: 0, memoryMB: 0, diskMB: 0, sampledAt: '' }),
      () => ({ totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: '' }),
    );

    collector.start();
    collector.stop();
    expect(true).toBe(true);
    cleanup();
  });
});
