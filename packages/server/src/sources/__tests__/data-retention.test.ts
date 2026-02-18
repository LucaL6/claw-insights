import { describe, it, expect, vi } from 'vitest';
import { DataRetention, type RetentionConfig } from '../data-retention';
import { initDatabase } from '../../db/init';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function setup(configOverrides: Partial<RetentionConfig> = {}) {
  const dbPath = join(tmpdir(), `dr-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase(dbPath);
  const config: RetentionConfig = {
    rawRetentionDays: 7,
    hourlyRetention: 'permanent',
    aggregateIntervalMs: 60_000,
    ...configOverrides,
  };
  const retention = new DataRetention(db, config);
  return {
    db,
    retention,
    config,
    cleanup: () => {
      retention.stop();
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-wal', { force: true });
      rmSync(dbPath + '-shm', { force: true });
    },
  };
}

/** Get a UTC hour string N hours ago */
function hoursAgo(n: number): string {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() - n);
  return d.toISOString().replace(/\d{2}:\d{2}\.\d{3}Z$/, '00:00.000Z');
}

/** Get a UTC hour string N days ago */
function daysAgoHour(n: number): string {
  return hoursAgo(n * 24);
}

/** Insert N metric_samples evenly across an hour */
function insertSamplesForHour(
  db: ReturnType<typeof initDatabase>,
  hourISO: string,
  count: number,
  overrides: Partial<{
    active_sessions: number;
    total_tokens_k: number;
    cost_today: number;
    cpu: number;
    memory_mb: number;
  }> = {},
) {
  const baseTime = new Date(hourISO).getTime() + 1000; // offset 1s into the hour
  const step = Math.floor(3_500_000 / Math.max(count, 1)); // stay within the hour
  const insert = db.prepare(`
    INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb)
    VALUES (?, ?, ?, 0, ?, 0, ?, ?)
  `);
  for (let i = 0; i < count; i++) {
    const ts = new Date(baseTime + i * step).toISOString();
    insert.run(
      ts,
      overrides.active_sessions ?? 2,
      (overrides.total_tokens_k ?? 100) + i * 10,
      (overrides.cost_today ?? 5) + i * 0.1,
      overrides.cpu ?? 10,
      overrides.memory_mb ?? 256,
    );
  }
}

function insertModelSamples(
  db: ReturnType<typeof initDatabase>,
  hourISO: string,
  model: string,
  tokenValues: number[],
) {
  const baseTime = new Date(hourISO).getTime() + 1000;
  const step = Math.floor(3_500_000 / Math.max(tokenValues.length, 1));
  const insert = db.prepare(`INSERT INTO model_token_samples (timestamp, model, total_tokens_k) VALUES (?, ?, ?)`);
  for (let i = 0; i < tokenValues.length; i++) {
    insert.run(new Date(baseTime + i * step).toISOString(), model, tokenValues[i]);
  }
}

describe('DataRetention', () => {
  it('aggregates completed hours into hourly_metric_samples', () => {
    const { db, retention, cleanup } = setup();
    const hour = hoursAgo(3);

    insertSamplesForHour(db, hour, 6, { active_sessions: 3, total_tokens_k: 100, cpu: 20, memory_mb: 512 });

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM hourly_metric_samples').all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].active_sessions_max).toBe(3);
    expect(rows[0].sample_count).toBe(6);
    expect(rows[0].cpu_max).toBe(20);
    expect(rows[0].memory_mb_max).toBe(512);
    cleanup();
  });

  it('aggregates model tokens per hour', () => {
    const { db, retention, cleanup } = setup();
    const hour = hoursAgo(3);

    insertSamplesForHour(db, hour, 3);
    insertModelSamples(db, hour, 'claude-3', [50, 80, 120]);
    insertModelSamples(db, hour, 'gpt-4', [10, 10, 30]);

    retention.runOnce();

    const models = db.prepare('SELECT * FROM hourly_model_tokens ORDER BY model').all() as any[];
    expect(models.length).toBe(2);
    expect(models[0].model).toBe('claude-3');
    expect(models[0].token_delta_k).toBe(70);
    expect(models[1].model).toBe('gpt-4');
    expect(models[1].token_delta_k).toBe(20);
    cleanup();
  });

  it('does NOT aggregate the current (incomplete) hour', () => {
    const { db, retention, cleanup } = setup();
    const currentHour = hoursAgo(0);

    insertSamplesForHour(db, currentHour, 3);

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM hourly_metric_samples').all() as any[];
    expect(rows.length).toBe(0);
    cleanup();
  });

  it('does NOT re-aggregate already-aggregated hours (idempotent)', () => {
    const { db, retention, cleanup } = setup();
    const hour = hoursAgo(3);

    insertSamplesForHour(db, hour, 4);
    retention.runOnce();
    expect((db.prepare('SELECT * FROM hourly_metric_samples').all() as any[]).length).toBe(1);

    retention.runOnce();
    expect((db.prepare('SELECT * FROM hourly_metric_samples').all() as any[]).length).toBe(1);
    cleanup();
  });

  it('prunes raw data older than rawRetentionDays when aggregated', () => {
    const { db, retention, cleanup } = setup({ rawRetentionDays: 1 });
    const hour = daysAgoHour(3);

    insertSamplesForHour(db, hour, 4);
    insertModelSamples(db, hour, 'test-model', [10, 20, 30, 40]);

    retention.runOnce();

    expect((db.prepare('SELECT * FROM hourly_metric_samples').all() as any[]).length).toBe(1);
    expect((db.prepare('SELECT * FROM metric_samples').all() as any[]).length).toBe(0);
    expect((db.prepare('SELECT * FROM model_token_samples').all() as any[]).length).toBe(0);
    cleanup();
  });

  it('does NOT prune raw data when rawRetentionDays is 0', () => {
    const { db, retention, cleanup } = setup({ rawRetentionDays: 0 });
    const hour = daysAgoHour(3);

    insertSamplesForHour(db, hour, 4);
    retention.runOnce();

    expect((db.prepare('SELECT * FROM metric_samples').all() as any[]).length).toBe(4);
    cleanup();
  });

  it('prunes hourly data when hourlyRetention is a number', () => {
    const { db, retention, cleanup } = setup({ rawRetentionDays: 0, hourlyRetention: '30' });
    const oldHour = daysAgoHour(60);

    db.prepare(
      `INSERT INTO hourly_metric_samples (hour, active_sessions_max, active_sessions_avg, token_delta_k, cost_end, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count) VALUES (?, 5, 3, 100, 10, 5, 10, 256, 512, 10)`,
    ).run(oldHour);
    db.prepare(`INSERT INTO hourly_model_tokens (hour, model, token_delta_k) VALUES (?, 'test', 50)`).run(oldHour);

    retention.runOnce();

    expect((db.prepare('SELECT * FROM hourly_metric_samples').all() as any[]).length).toBe(0);
    expect((db.prepare('SELECT * FROM hourly_model_tokens').all() as any[]).length).toBe(0);
    cleanup();
  });

  it('guards against concurrent runOnce calls', () => {
    const { retention, cleanup } = setup();
    const r = retention as any;
    r.isRunning = true;

    const spy = vi.spyOn(r, 'aggregate');
    retention.runOnce();
    expect(spy).not.toHaveBeenCalled();

    r.isRunning = false;
    cleanup();
  });

  it('start/stop manages the timer', () => {
    const { retention, cleanup } = setup({ aggregateIntervalMs: 100_000 });
    expect((retention as any).timer).toBeNull();

    retention.start();
    expect((retention as any).timer).not.toBeNull();

    retention.stop();
    expect((retention as any).timer).toBeNull();
    cleanup();
  });

  it('cost_end is the last cost_today value in the hour', () => {
    const { db, retention, cleanup } = setup();
    const hour = hoursAgo(3);

    // cost_today goes: 10, 10.1, 10.2, 10.3, 10.4
    insertSamplesForHour(db, hour, 5, { cost_today: 10 });

    retention.runOnce();

    const row = db.prepare('SELECT cost_end FROM hourly_metric_samples').get() as any;
    expect(row.cost_end).toBeCloseTo(10.4, 1);
    cleanup();
  });

  it('computes token_delta_k as max - min of total_tokens_k', () => {
    const { db, retention, cleanup } = setup();
    const hour = hoursAgo(3);

    // total_tokens_k goes: 100, 110, 120, 130
    insertSamplesForHour(db, hour, 4, { total_tokens_k: 100 });

    retention.runOnce();

    const row = db.prepare('SELECT token_delta_k FROM hourly_metric_samples').get() as any;
    expect(row.token_delta_k).toBe(30);
    cleanup();
  });
});
