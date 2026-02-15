import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DEFAULT_DB_PATH = `${process.env.HOME}/.openclaw/dashboard/metrics.db`;

const DDL = `
CREATE TABLE IF NOT EXISTS metric_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  type      TEXT NOT NULL,
  value     REAL,
  metadata  TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_type_time
  ON metric_events(type, timestamp);

CREATE INDEX IF NOT EXISTS idx_events_time
  ON metric_events(timestamp DESC);

CREATE TABLE IF NOT EXISTS metric_samples (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp        TEXT NOT NULL,
  active_sessions  INTEGER NOT NULL DEFAULT 0,
  total_tokens_k   REAL NOT NULL DEFAULT 0,
  token_delta_k    REAL NOT NULL DEFAULT 0,
  cost_today       REAL NOT NULL DEFAULT 0,
  tokens_today_m   REAL NOT NULL DEFAULT 0,
  cpu              REAL NOT NULL DEFAULT 0,
  memory_mb        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_samples_time
  ON metric_samples(timestamp DESC);
`;

export function initDatabase(dbPath: string = DEFAULT_DB_PATH): Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA synchronous=NORMAL');
  db.exec(DDL);
  return db;
}
