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
`;

export function initDatabase(dbPath: string = DEFAULT_DB_PATH): Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA synchronous=NORMAL');
  db.exec(DDL);
  return db;
}
