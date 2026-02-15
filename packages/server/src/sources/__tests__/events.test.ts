import { describe, it, expect } from 'bun:test';
import { dataBus, emitChange, type DataChangeEvent } from '../../events';
import { MetricsCollector } from '../metrics-collector';
import { initDatabase } from '../../db/init';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

describe('dataBus', () => {
  it('should emit change events with source and ts', () => {
    const received: Array<{ source: string; ts: string }> = [];
    dataBus.on('change', (e) => received.push(e));

    emitChange('sessions');
    emitChange('metrics');
    emitChange('gateway');

    expect(received).toHaveLength(3);
    expect(received[0].source).toBe('sessions');
    expect(received[1].source).toBe('metrics');
    expect(received[2].source).toBe('gateway');
    expect(received[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    dataBus.removeAllListeners();
  });
});

describe('dataBus integration', () => {
  it('MetricsCollector.sampleFast emits metrics signal', () => {
    const dbPath = join(tmpdir(), `evt-${Date.now()}.db`);
    const db = initDatabase(dbPath);
    const received: string[] = [];
    dataBus.on('change', (e: DataChangeEvent) => received.push(e.source));

    const mc = new MetricsCollector(
      db,
      { getSessions: () => [{ key: 'a', status: 'ACTIVE', totalTokens: 1000 }] },
      () => ({ cpu: 1, memoryMB: 100, diskMB: 500, sampledAt: new Date().toISOString() }),
      () => ({ totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: new Date().toISOString() }),
    );

    mc.sampleFast();
    expect(received).toContain('metrics');

    dataBus.removeAllListeners();
    db.close();
    rmSync(dbPath, { force: true });
  });
});
