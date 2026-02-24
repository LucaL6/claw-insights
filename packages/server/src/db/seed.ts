/**
 * E2E test seed data — populates SQLite with deterministic metric and event data.
 *
 * NOTE: Only DB-backed data (metric_samples, metric_events, model_token_samples,
 * hourly_metric_samples, hourly_model_tokens) can be seeded.
 * Sessions, channels, cron, and gateway status come from live sources
 * (files / CLI) and are NOT seeded here.
 */
import { DatabaseSync } from 'node:sqlite';

import { createChildLogger } from '../logger.js';
import { initDatabase } from './init.js';

const log = createChildLogger('db-seed');

// ── Seed ──

export function seedTestData(dbPath: string): DatabaseSync {
  const db = initDatabase(dbPath);

  const now = Date.now();
  // ── metric_samples: 48 rows, every 30 min over 24h ──
  const sampleStmt = db.prepare(
    `INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let i = 0; i < 48; i++) {
    const ts = new Date(now - (47 - i) * 30 * 60 * 1000).toISOString();
    const sessions = 1 + (i % 4); // 1-4 active sessions
    const totalTokensK = 100 + i * 5.2;
    const tokenDeltaK = 3 + Math.sin(i / 3) * 2;
    const costToday = 0.5 + i * 0.03;
    const tokensTodayM = 0.01 + i * 0.002;
    const cpu = 15 + Math.sin(i / 6) * 10;
    const memoryMb = 256 + (i % 8) * 32;
    sampleStmt.run(ts, sessions, totalTokensK, tokenDeltaK, costToday, tokensTodayM, cpu, memoryMb);
  }

  // ── model_token_samples: 48 rows × 2 models ──
  const modelStmt = db.prepare(
    `INSERT INTO model_token_samples (timestamp, model, total_tokens_k, token_delta_k) VALUES (?, ?, ?, ?)`,
  );
  const models = ['claude-sonnet-4-20250514', 'gpt-4o'];
  const prevModelK: Record<string, number> = {};
  for (let i = 0; i < 48; i++) {
    const ts = new Date(now - (47 - i) * 30 * 60 * 1000).toISOString();
    const m0K = 80 + i * 3.5;
    const m1K = 20 + i * 1.7;
    const d0 = i === 0 ? 0 : Math.max(0, m0K - (prevModelK[models[0]] ?? m0K));
    const d1 = i === 0 ? 0 : Math.max(0, m1K - (prevModelK[models[1]] ?? m1K));
    modelStmt.run(ts, models[0], m0K, d0);
    modelStmt.run(ts, models[1], m1K, d1);
    prevModelK[models[0]] = m0K;
    prevModelK[models[1]] = m1K;
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

  // ── hourly_metric_samples: 24 rows ──
  const hourlyStmt = db.prepare(
    `INSERT INTO hourly_metric_samples (hour, active_sessions_max, active_sessions_avg, token_delta_k, cost_end, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let i = 0; i < 24; i++) {
    const hour = new Date(now - (23 - i) * 60 * 60 * 1000);
    hour.setMinutes(0, 0, 0);
    const hourTs = hour.toISOString();
    hourlyStmt.run(
      hourTs,
      2 + (i % 3),
      1.5 + (i % 3) * 0.5,
      6 + i * 0.5,
      0.5 + i * 0.06,
      15 + i,
      25 + i,
      280 + i * 10,
      320 + i * 10,
      2,
    );
  }

  // ── hourly_model_tokens: 24 rows × 2 models ──
  const hourlyModelStmt = db.prepare(`INSERT INTO hourly_model_tokens (hour, model, token_delta_k) VALUES (?, ?, ?)`);
  for (let i = 0; i < 24; i++) {
    const hour = new Date(now - (23 - i) * 60 * 60 * 1000);
    hour.setMinutes(0, 0, 0);
    const hourTs = hour.toISOString();
    hourlyModelStmt.run(hourTs, models[0], 4 + i * 0.3);
    hourlyModelStmt.run(hourTs, models[1], 2 + i * 0.2);
  }

  log.info('test data inserted');
  return db;
}

// ── Clean ──

export function cleanTestData(dbPath: string): void {
  const db = new DatabaseSync(dbPath);
  const tables = [
    'metric_events',
    'metric_samples',
    'model_token_samples',
    'hourly_metric_samples',
    'hourly_model_tokens',
  ];
  for (const t of tables) {
    db.exec(`DELETE FROM ${t}`);
  }
  db.close();
  log.info('test data cleaned');
}
