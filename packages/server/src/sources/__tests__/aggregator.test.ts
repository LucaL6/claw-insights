import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../../db/init.js';
import { Aggregator } from '../aggregator';
import { createLogIngester } from '../collectors/log/ingester';

function setup() {
  const dbPath = join(tmpdir(), `agg-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase({ dbPath });
  const agg = new Aggregator(db);
  const ingestLog = createLogIngester(db);
  return {
    db,
    agg,
    ingestLog,
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
    const { agg, ingestLog, cleanup } = setup();

    ingestLog({ time: '10:00:00.000', level: 'ERROR', module: 'tools', message: 'exec failed' });
    ingestLog({ time: '10:00:01.000', level: 'WARN', module: 'agent/embedded', message: 'slow' });
    ingestLog({ time: '10:00:02.000', level: 'INFO', module: 'tools', message: 'tool start exec' });
    ingestLog({
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
    const { agg, ingestLog, cleanup } = setup();
    ingestLog({ time: '10:00:00', level: 'INFO', module: 'tools', message: 'tool start exec' });
    ingestLog({ time: '10:00:01', level: 'INFO', module: 'tools', message: 'tool start read' });
    const m = agg.getMetrics() as { buckets: Array<{ toolCalls: number }> };
    const totalToolCalls = m.buckets.reduce((s, b) => s + b.toolCalls, 0);
    expect(totalToolCalls).toBe(2);
    cleanup();
  });

  it('should count api_call events (embedded run tool start)', () => {
    const { agg, ingestLog, cleanup } = setup();
    ingestLog({
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

  it('should read sessions from system_samples and tokens from token_usage_events', () => {
    const { agg, db, ingestLog: _ingestLog, cleanup } = setup();
    const now = new Date();
    const ts = now.toISOString();
    const ts2 = new Date(now.getTime() - 1000).toISOString(); // 1s earlier, same bucket
    db.prepare('INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb) VALUES (?, ?, 0, 0)').run(
      ts2,
      7,
    );
    db.prepare('INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb) VALUES (?, ?, 0, 0)').run(
      ts,
      7,
    );
    // Insert token usage events
    db.prepare(
      'INSERT INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, 0, 0)',
    ).run(ts2, 'sess1', 'claude', 0, 0);
    db.prepare(
      'INSERT INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, 0, 0)',
    ).run(ts, 'sess1', 'claude', 6000, 6000); // 12K total tokens = 12 tokensK (input+output in tokens, /1000 = K)

    const m = agg.getMetrics() as { totalTokensK: number; buckets: Array<{ sessions: number; tokensK: number }> };
    const bucketWithData = m.buckets.find((b: { sessions: number }) => b.sessions > 0);
    expect(bucketWithData).toBeDefined();
    expect(bucketWithData!.sessions).toBe(7);
    cleanup();
  });

  it('should group model tokens by bucket (L65-69)', () => {
    const { agg, db, cleanup } = setup();
    const now = new Date();
    const ts1 = new Date(now.getTime() - 2000).toISOString();
    const ts2 = new Date(now.getTime() - 1000).toISOString();

    // Insert tokens for 2 different models in the same time bucket
    const insert = db.prepare(
      'INSERT INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, 0, 0)',
    );
    insert.run(ts1, 'sess1', 'claude-opus', 1000, 500);
    insert.run(ts2, 'sess1', 'claude-sonnet', 2000, 1000);

    agg.clearCache();
    const m = agg.getMetrics() as {
      buckets: Array<{ tokensByModel?: Array<{ model: string; tokensK: number }> }>;
    };
    // At least one bucket should have model token data
    const withModels = m.buckets.filter((b) => b.tokensByModel && b.tokensByModel.length > 0);
    expect(withModels.length).toBeGreaterThan(0);
    cleanup();
  });

  it('should detect gateway restart events', () => {
    const { agg, ingestLog, cleanup } = setup();
    ingestLog({ time: '10:00:00', level: 'INFO', module: 'system', message: 'gateway restart completed' });
    const m = agg.getMetrics() as { buckets: Array<{ restartEvent: boolean }> };
    const hasRestart = m.buckets.some((b) => b.restartEvent);
    expect(hasRestart).toBe(true);
    cleanup();
  });

  it('should cache metrics for 60s', () => {
    const { agg, ingestLog, cleanup } = setup();
    ingestLog({ time: '10:00:00', level: 'ERROR', module: 'tools', message: 'fail' });
    const m1 = agg.getMetrics() as { totalErrors: number };
    ingestLog({ time: '10:00:01', level: 'ERROR', module: 'tools', message: 'fail again' });
    const m2 = agg.getMetrics() as { totalErrors: number };
    // Should be same cached object (1 error, not 2)
    expect(m1.totalErrors).toBe(m2.totalErrors);
    cleanup();
  });

  it('should invalidate cache when clearCache is called', () => {
    const { agg, ingestLog, cleanup } = setup();
    ingestLog({ time: '10:00:00', level: 'ERROR', module: 'test', message: 'error1' });
    const m1 = agg.getMetrics() as { totalErrors: number };
    expect(m1.totalErrors).toBe(1);

    ingestLog({ time: '10:00:01', level: 'ERROR', module: 'test', message: 'error2' });
    const m2 = agg.getMetrics() as { totalErrors: number };
    expect(m2.totalErrors).toBe(1); // still cached

    agg.clearCache();
    const m3 = agg.getMetrics() as { totalErrors: number };
    expect(m3.totalErrors).toBe(2); // cache cleared
    cleanup();
  });

  it('should return empty metrics for future date', () => {
    const { agg, ingestLog: _ingestLog, cleanup } = setup();
    const m = agg.getMetrics('2099-01-01') as { totalErrors: number; totalTokensK: number; buckets: unknown[] };
    expect(m.totalErrors).toBe(0);
    expect(m.totalTokensK).toBe(0);
    expect(m.buckets.length).toBeGreaterThan(0);
    cleanup();
  });

  it('should split turns by user and assistant roles', () => {
    const { agg, db, cleanup } = setup();
    const now = new Date();
    const ts1 = new Date(now.getTime() - 2000).toISOString();
    const ts2 = new Date(now.getTime() - 1000).toISOString();
    const ts3 = now.toISOString();

    // Insert message_events with different roles
    const insert = db.prepare(
      'INSERT INTO message_events (timestamp, session_key, role, content_hash) VALUES (?, ?, ?, ?)',
    );
    insert.run(ts1, 'sess1', 'user', `hash-u-${Date.now()}`);
    insert.run(ts2, 'sess1', 'assistant', `hash-a-${Date.now()}`);
    insert.run(ts3, 'sess1', 'user', `hash-u2-${Date.now()}`);

    agg.clearCache();
    const m = agg.getMetrics() as {
      buckets: Array<{ turns: number; userTurns: number; assistantTurns: number }>;
    };
    const totalUserTurns = m.buckets.reduce((s, b) => s + b.userTurns, 0);
    const totalAssistantTurns = m.buckets.reduce((s, b) => s + b.assistantTurns, 0);
    const totalTurns = m.buckets.reduce((s, b) => s + b.turns, 0);

    expect(totalUserTurns).toBe(2);
    expect(totalAssistantTurns).toBe(1);
    expect(totalTurns).toBe(3);
    cleanup();
  });

  it('should separate metrics by date', () => {
    const { agg, db, ingestLog, cleanup } = setup();
    // Insert event with an old date timestamp
    db.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)').run(
      '2025-01-01T10:00:00Z',
      'error',
      null,
      '{"module":"test"}',
    );
    ingestLog({ time: '10:00:00', level: 'ERROR', module: 'test', message: 'today error' });
    const today = agg.getMetrics() as { totalErrors: number };
    const oldDate = agg.getMetrics('2025-01-01') as { totalErrors: number };
    expect(today.totalErrors).toBe(1);
    expect(oldDate.totalErrors).toBe(1);
    cleanup();
  });
});
