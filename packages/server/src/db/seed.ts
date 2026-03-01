/**
 * E2E test seed data — populates SQLite with deterministic metric and event data.
 *
 * NOTE: Only DB-backed data (system_samples, metric_events, token_usage_events,
 * hourly_system_samples) can be seeded.
 * Sessions, channels, cron, and gateway status come from live sources
 * (files / CLI) and are NOT seeded here.
 */
import { createChildLogger } from '../logger.js';
import type { Database } from './database.js';
import { initDatabase } from './init.js';
import { createSqliteDatabase } from './sqlite-provider.js';

const log = createChildLogger('db-seed');

// ── Seed ──

export function seedTestData(dbPath: string): Database {
  const db = initDatabase({ dbPath });

  const now = Date.now();
  // ── system_samples: 48 rows, every 30 min over 24h ──
  const sampleStmt = db.prepare(
    `INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb)
     VALUES (?, ?, ?, ?)`,
  );
  for (let i = 0; i < 48; i++) {
    const ts = new Date(now - (47 - i) * 30 * 60 * 1000).toISOString();
    const sessions = 1 + (i % 4); // 1-4 active sessions
    const cpu = 15 + Math.sin(i / 6) * 10;
    const memoryMb = 256 + (i % 8) * 32;
    sampleStmt.run(ts, sessions, cpu, memoryMb);
  }

  // ── token_usage_events: 96 rows (2 models × 48 timestamps) ──
  const tokenStmt = db.prepare(
    `INSERT OR IGNORE INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const models = ['claude-sonnet-4-20250514', 'gpt-4o'];
  for (let i = 0; i < 48; i++) {
    const ts = new Date(now - (47 - i) * 30 * 60 * 1000).toISOString();
    for (const model of models) {
      const input = 500 + i * 20 + (model === models[0] ? 0 : 100);
      const output = 200 + i * 10;
      const cacheRead = Math.floor(input * 0.3);
      const cacheWrite = Math.floor(input * 0.1);
      tokenStmt.run(ts, `session-${(i % 4) + 1}`, model, input, output, cacheRead, cacheWrite);
    }
  }

  // ── metric_events: ~100 rows (mixed types over 24h) ──
  const eventStmt = db.prepare(
    `INSERT INTO metric_events (timestamp, type, value, metadata, category, source)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const eventTypes: Array<{
    type: string;
    category: string;
    source: string;
    count: number;
    metaFn: (i: number) => string;
  }> = [
    {
      type: 'error',
      category: 'severity.error',
      source: 'openclaw',
      count: 25,
      metaFn: (i) => JSON.stringify({ module: 'agent', message: `Test error ${i}: connection timeout` }),
    },
    {
      type: 'warning',
      category: 'severity.warning',
      source: 'openclaw',
      count: 30,
      metaFn: (i) => JSON.stringify({ module: 'gateway', message: `Rate limit approaching: ${80 + i}%` }),
    },
    {
      type: 'gateway_restart',
      category: 'lifecycle.restart',
      source: 'openclaw.gateway',
      count: 3,
      metaFn: () => JSON.stringify({}),
    },
    {
      type: 'tool_call',
      category: 'activity.tool_call',
      source: 'openclaw',
      count: 30,
      metaFn: (i) => JSON.stringify({ module: 'agent', message: `Tool call ${i}` }),
    },
    {
      type: 'api_call',
      category: 'activity.api_call',
      source: 'openclaw',
      count: 15,
      metaFn: (i) => JSON.stringify({ module: 'agent', message: `API call ${i}` }),
    },
  ];

  let eventIndex = 0;
  for (const et of eventTypes) {
    for (let i = 0; i < et.count; i++) {
      const offset = eventIndex * 14.4 * 60 * 1000; // spread ~evenly over 24h
      const ts = new Date(now - 24 * 60 * 60 * 1000 + offset).toISOString();
      eventStmt.run(
        ts,
        et.type,
        et.type === 'tool_call' || et.type === 'api_call' ? 1 : null,
        et.metaFn(i),
        et.category,
        et.source,
      );
      eventIndex++;
    }
  }

  // ── hourly_system_samples: 24 rows ──
  const hourlyStmt = db.prepare(
    `INSERT INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let i = 0; i < 24; i++) {
    const hour = new Date(now - (23 - i) * 60 * 60 * 1000);
    hour.setMinutes(0, 0, 0);
    const hourTs = hour.toISOString();
    hourlyStmt.run(hourTs, 2 + (i % 3), 1.5 + (i % 3) * 0.5, 15 + i, 25 + i, 280 + i * 10, 320 + i * 10, 2);
  }

  log.info('test data inserted');
  return db;
}

// ── Clean ──

export function cleanTestData(dbPath: string): void {
  const db = createSqliteDatabase(dbPath);
  const tables = ['metric_events', 'system_samples', 'token_usage_events', 'hourly_system_samples'];
  for (const t of tables) {
    db.exec(`DELETE FROM ${t}`);
  }
  db.close();
  log.info('test data cleaned');
}
