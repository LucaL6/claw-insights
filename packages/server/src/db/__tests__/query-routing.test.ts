import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../init.js';
import {
  getBucketedSampledSessions,
  getBucketedSampledTokens,
  getBucketedModelTokens,
  getRangeTokensK,
} from '../metric-queries.js';
import type { DatabaseSync as Database } from 'node:sqlite';

let db: Database;

beforeEach(() => {
  db = initDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

function insertHourlySample(
  db: Database,
  hour: string,
  opts: {
    sessionsMax?: number;
    sessionsAvg?: number;
    tokenDelta?: number;
    costEnd?: number;
    cpuAvg?: number;
    cpuMax?: number;
    memAvg?: number;
    memMax?: number;
    count?: number;
  },
) {
  db.prepare(
    `INSERT INTO hourly_metric_samples
    (hour, active_sessions_max, active_sessions_avg, token_delta_k, cost_end, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    hour,
    opts.sessionsMax ?? 0,
    opts.sessionsAvg ?? 0,
    opts.tokenDelta ?? 0,
    opts.costEnd ?? 0,
    opts.cpuAvg ?? 0,
    opts.cpuMax ?? 0,
    opts.memAvg ?? 0,
    opts.memMax ?? 0,
    opts.count ?? 60,
  );
}

function insertHourlyModel(db: Database, hour: string, model: string, tokenDelta: number) {
  db.prepare('INSERT INTO hourly_model_tokens (hour, model, token_delta_k) VALUES (?, ?, ?)').run(
    hour,
    model,
    tokenDelta,
  );
}

describe('Query routing — hourly fallback', () => {
  it('getBucketedSampledSessions should return data from hourly table when useHourly=true', () => {
    insertHourlySample(db, '2026-02-10T14:00:00Z', { sessionsMax: 8, sessionsAvg: 5 });
    const results = getBucketedSampledSessions(db, '2026-02-10T14:00:00Z', '2026-02-10T15:00:00Z', 60, true);
    expect(results.length).toBe(1);
    expect(results[0].sessions).toBe(8);
  });

  it('getBucketedSampledTokens should return delta from hourly table when useHourly=true', () => {
    insertHourlySample(db, '2026-02-10T14:00:00Z', { tokenDelta: 42.5 });
    const results = getBucketedSampledTokens(db, '2026-02-10T14:00:00Z', '2026-02-10T15:00:00Z', 60, true);
    expect(results.length).toBe(1);
    expect(results[0].tokensK).toBeCloseTo(42.5);
  });

  it('getBucketedModelTokens should return per-model delta from hourly when useHourly=true', () => {
    insertHourlyModel(db, '2026-02-10T14:00:00Z', 'claude-opus-4-6', 25.0);
    insertHourlyModel(db, '2026-02-10T14:00:00Z', 'gpt-5.3-codex', 15.0);
    const results = getBucketedModelTokens(db, '2026-02-10T14:00:00Z', '2026-02-10T15:00:00Z', 60, true);
    expect(results.length).toBe(2);
    const claude = results.find((r) => r.model === 'claude-opus-4-6');
    expect(claude!.tokensK).toBeCloseTo(25.0);
  });

  it('getRangeTokensK should sum hourly deltas when useHourly=true', () => {
    insertHourlySample(db, '2026-02-10T14:00:00Z', { tokenDelta: 10 });
    insertHourlySample(db, '2026-02-10T15:00:00Z', { tokenDelta: 20 });
    const total = getRangeTokensK(db, '2026-02-10T14:00:00Z', '2026-02-10T16:00:00Z', true);
    expect(total).toBeCloseTo(30);
  });

  it('should return empty from hourly table when no data exists', () => {
    const results = getBucketedSampledSessions(db, '2026-02-10T14:00:00Z', '2026-02-10T15:00:00Z', 60, true);
    expect(results.length).toBe(0);
  });

  it('should use raw table when useHourly=false (default)', () => {
    db.prepare(
      `INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('2026-02-10T14:05:00Z', 3, 100, 0, 5, 1, 10, 256);
    const results = getBucketedSampledSessions(db, '2026-02-10T14:00:00Z', '2026-02-10T15:00:00Z', 60);
    expect(results.length).toBe(1);
    expect(results[0].sessions).toBe(3);
  });
});
