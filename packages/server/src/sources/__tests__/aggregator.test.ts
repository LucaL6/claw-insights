import { describe, it, expect } from 'vitest';
import { initDatabase } from '../../db/init';
import { Aggregator } from '../aggregator';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function setup() {
  const dbPath = join(tmpdir(), `agg-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase(dbPath);
  const agg = new Aggregator(db);
  return {
    db,
    agg,
    dbPath,
    cleanup: () => {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-wal', { force: true });
      rmSync(dbPath + '-shm', { force: true });
    },
  };
}

describe('Aggregator', () => {
  it('should ingest logs and produce metrics summary', () => {
    const { agg, cleanup } = setup();

    agg.ingestLog({ time: '10:00:00.000', level: 'ERROR', module: 'tools', message: 'exec failed' });
    agg.ingestLog({ time: '10:00:01.000', level: 'WARN', module: 'agent/embedded', message: 'slow' });
    agg.ingestLog({ time: '10:00:02.000', level: 'INFO', module: 'tools', message: 'tool start exec' });
    agg.ingestLog({
      time: '10:00:03.000',
      level: 'INFO',
      module: 'agent/embedded',
      message: 'embedded run tool start',
    });

    const m = agg.getMetrics() as { totalErrors: number; totalWarnings: number; buckets: unknown[] };
    expect(m.totalErrors).toBe(1);
    expect(m.totalWarnings).toBe(1);
    expect(m.buckets.length).toBeGreaterThan(0);

    cleanup();
  });

  it('should count tool_call events', () => {
    const { agg, cleanup } = setup();
    agg.ingestLog({ time: '10:00:00', level: 'INFO', module: 'tools', message: 'tool start exec' });
    agg.ingestLog({ time: '10:00:01', level: 'INFO', module: 'tools', message: 'tool start read' });
    const m = agg.getMetrics() as { buckets: Array<{ toolCalls: number }> };
    const totalToolCalls = m.buckets.reduce((s, b) => s + b.toolCalls, 0);
    expect(totalToolCalls).toBe(2);
    cleanup();
  });

  it('should count api_call events (embedded run tool start)', () => {
    const { agg, cleanup } = setup();
    agg.ingestLog({
      time: '10:00:00',
      level: 'INFO',
      module: 'agent/embedded',
      message: 'embedded run tool start sessions_list',
    });
    const m = agg.getMetrics() as { buckets: Array<{ apiCalls: number }> };
    const totalApiCalls = m.buckets.reduce((s, b) => s + b.apiCalls, 0);
    expect(totalApiCalls).toBe(1);
    cleanup();
  });

  it('should read sessions and tokens from metric_samples', () => {
    const { agg, db, cleanup } = setup();
    const now = new Date();
    const ts = now.toISOString();
    const ts2 = new Date(now.getTime() - 1000).toISOString(); // 1s earlier, same bucket
    db.prepare(
      'INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb) VALUES (?, ?, ?, ?, 0, 0, 0, 0)',
    ).run(ts2, 7, 0, 0);
    db.prepare(
      'INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb) VALUES (?, ?, ?, ?, 0, 0, 0, 0)',
    ).run(ts, 7, 250, 12);

    const m = agg.getMetrics() as { totalTokensK: number; buckets: Array<{ sessions: number; tokensK: number }> };
    const bucketWithData = m.buckets.find((b: any) => b.sessions > 0);
    expect(bucketWithData).toBeDefined();
    expect(bucketWithData!.sessions).toBe(7);
    expect(bucketWithData!.tokensK).toBe(250); // MAX(250) - MIN(0) = 250
    expect(m.totalTokensK).toBe(250);
    cleanup();
  });

  it('should detect gateway restart events', () => {
    const { agg, cleanup } = setup();
    agg.ingestLog({ time: '10:00:00', level: 'INFO', module: 'system', message: 'gateway restart completed' });
    const m = agg.getMetrics() as { buckets: Array<{ restartEvent: boolean }> };
    const hasRestart = m.buckets.some((b) => b.restartEvent);
    expect(hasRestart).toBe(true);
    cleanup();
  });

  it('should cache metrics for 60s', () => {
    const { agg, cleanup } = setup();
    agg.ingestLog({ time: '10:00:00', level: 'ERROR', module: 'tools', message: 'fail' });
    const m1 = agg.getMetrics() as { totalErrors: number };
    agg.ingestLog({ time: '10:00:01', level: 'ERROR', module: 'tools', message: 'fail again' });
    const m2 = agg.getMetrics() as { totalErrors: number };
    // Should be same cached object (1 error, not 2)
    expect(m1.totalErrors).toBe(m2.totalErrors);
    cleanup();
  });

  it('should invalidate cache when clearCache is called', () => {
    const { agg, cleanup } = setup();
    agg.ingestLog({ time: '10:00:00', level: 'ERROR', module: 'test', message: 'error1' });
    const m1 = agg.getMetrics() as { totalErrors: number };
    expect(m1.totalErrors).toBe(1);

    agg.ingestLog({ time: '10:00:01', level: 'ERROR', module: 'test', message: 'error2' });
    const m2 = agg.getMetrics() as { totalErrors: number };
    expect(m2.totalErrors).toBe(1); // still cached

    agg.clearCache();
    const m3 = agg.getMetrics() as { totalErrors: number };
    expect(m3.totalErrors).toBe(2); // cache cleared
    cleanup();
  });

  it('should return empty metrics for future date', () => {
    const { agg, cleanup } = setup();
    const m = agg.getMetrics('2099-01-01') as { totalErrors: number; totalTokensK: number; buckets: unknown[] };
    expect(m.totalErrors).toBe(0);
    expect(m.totalTokensK).toBe(0);
    expect(m.buckets.length).toBeGreaterThan(0);
    cleanup();
  });

  it('should separate metrics by date', () => {
    const { agg, db, cleanup } = setup();
    // Insert event with an old date timestamp
    db.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)').run(
      '2025-01-01T10:00:00Z',
      'error',
      null,
      '{"module":"test"}',
    );
    agg.ingestLog({ time: '10:00:00', level: 'ERROR', module: 'test', message: 'today error' });
    const today = agg.getMetrics() as { totalErrors: number };
    const oldDate = agg.getMetrics('2025-01-01') as { totalErrors: number };
    expect(today.totalErrors).toBe(1);
    expect(oldDate.totalErrors).toBe(1);
    cleanup();
  });
});
