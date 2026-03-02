import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../../../db/init.js';
import { dataBus, type DataChangeEvent, emitChange } from '../../../events';
import { SystemSampler } from '../metrics/collector.js';

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
  it('SystemSampler.sampleFast emits metrics signal', () => {
    const dbPath = join(tmpdir(), `evt-${Date.now()}.db`);
    const db = initDatabase({ dbPath });
    const received: string[] = [];
    dataBus.on('change', (e: DataChangeEvent) => received.push(e.source));

    const ss = new SystemSampler(
      db,
      {
        getSessions: () => [{ key: 'a', status: 'ACTIVE' }],
      },
      () => ({ cpu: 1, memoryMB: 100, diskMB: 500, sampledAt: new Date().toISOString() }),
    );

    ss.sampleFast();
    expect(received).toContain('metrics');

    dataBus.removeAllListeners();
    db.close();
    rmSync(dbPath, { force: true });
  });
});
