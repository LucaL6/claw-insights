import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config.js';
import { EVENT_MAP } from '../sources/events-mapper.js';

const DEFAULT_DB_PATH = config.dbPath;

// ── Migrations (single source of schema truth) ──

interface Migration {
  version: number;
  up: string | ((db: DatabaseSync) => void);
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS metric_events (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type      TEXT NOT NULL,
        value     REAL,
        metadata  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_events_type_time ON metric_events(type, timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_time ON metric_events(timestamp DESC);

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
      CREATE INDEX IF NOT EXISTS idx_samples_time ON metric_samples(timestamp DESC);

      CREATE TABLE IF NOT EXISTS model_token_samples (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp      TEXT NOT NULL,
        model          TEXT NOT NULL,
        total_tokens_k REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_model_samples_time ON model_token_samples(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_model_samples_model_time ON model_token_samples(model, timestamp);
    `,
  },
  {
    version: 2,
    up: (db) => {
      if (!hasColumn(db, 'metric_events', 'module')) {
        db.exec('ALTER TABLE metric_events ADD COLUMN module TEXT');
      }
      db.exec('CREATE INDEX IF NOT EXISTS idx_events_module ON metric_events(module)');
    },
  },
  {
    version: 3,
    up: (db) => {
      if (!hasColumn(db, 'metric_events', 'category')) {
        db.exec('ALTER TABLE metric_events ADD COLUMN category TEXT');
      }
      if (!hasColumn(db, 'metric_events', 'source')) {
        db.exec('ALTER TABLE metric_events ADD COLUMN source TEXT');
      }
      db.exec('CREATE INDEX IF NOT EXISTS idx_events_category ON metric_events(category)');
      backfillEventCategories(db);
    },
  },
  {
    version: 4,
    up: `
      CREATE TABLE IF NOT EXISTS hourly_metric_samples (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        hour                  TEXT NOT NULL,
        active_sessions_max   INTEGER NOT NULL DEFAULT 0,
        active_sessions_avg   REAL NOT NULL DEFAULT 0,
        token_delta_k         REAL NOT NULL DEFAULT 0,
        cost_end              REAL NOT NULL DEFAULT 0,
        cpu_avg               REAL NOT NULL DEFAULT 0,
        cpu_max               REAL NOT NULL DEFAULT 0,
        memory_mb_avg         REAL NOT NULL DEFAULT 0,
        memory_mb_max         INTEGER NOT NULL DEFAULT 0,
        sample_count          INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_samples_hour ON hourly_metric_samples(hour);

      CREATE TABLE IF NOT EXISTS hourly_model_tokens (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        hour            TEXT NOT NULL,
        model           TEXT NOT NULL,
        token_delta_k   REAL NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_model_hour ON hourly_model_tokens(hour, model);
    `,
  },
  {
    version: 5,
    up: (db) => {
      // Sanity check: verify all expected tables and critical columns exist
      const expectedTables = [
        'metric_events',
        'metric_samples',
        'model_token_samples',
        'hourly_metric_samples',
        'hourly_model_tokens',
      ];
      for (const table of expectedTables) {
        const row = db
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
          .get(table) as { name: string } | undefined;
        if (!row) {
          throw new Error(`[DB] Sanity check failed: table '${table}' missing. Run migrations from a clean state.`);
        }
      }

      const requiredColumns: Record<string, string[]> = {
        metric_events: ['id', 'timestamp', 'type', 'value', 'metadata', 'module', 'category', 'source'],
        metric_samples: [
          'id',
          'timestamp',
          'active_sessions',
          'total_tokens_k',
          'token_delta_k',
          'cost_today',
          'tokens_today_m',
          'cpu',
          'memory_mb',
        ],
        model_token_samples: ['id', 'timestamp', 'model', 'total_tokens_k'],
      };

      for (const [table, cols] of Object.entries(requiredColumns)) {
        const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
        const existing = new Set(info.map((c) => c.name));
        for (const col of cols) {
          if (!existing.has(col)) {
            throw new Error(`[DB] Sanity check failed: column '${table}.${col}' missing.`);
          }
        }
      }

      console.log('[DB] v5 sanity check passed — all tables and columns verified');
    },
  },
];

// ── Helpers ──

export function backfillEventCategories(db: DatabaseSync) {
  const stmt = db.prepare(
    'UPDATE metric_events SET category = ?, source = ? WHERE type = ? AND (category IS NULL OR source IS NULL)',
  );
  for (const [type, mapping] of Object.entries(EVENT_MAP)) {
    stmt.run(mapping.category, mapping.source, type);
  }
  db.prepare(
    "UPDATE metric_events SET category = 'uncategorized', source = 'unknown' WHERE category IS NULL OR source IS NULL",
  ).run();
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return info.some((c) => c.name === column);
}

function runMigrations(db: DatabaseSync) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null } | undefined;
  const current = row?.v ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version > current) {
      db.exec('BEGIN');
      try {
        if (typeof m.up === 'function') {
          m.up(db);
        } else {
          db.exec(m.up);
        }
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(m.version);
        db.exec('COMMIT');
        console.log(`[DB] Migrated to version ${m.version}`);
      } catch (err) {
        db.exec('ROLLBACK');
        console.error(`[DB] Migration ${m.version} failed:`, err);
        throw err;
      }
    }
  }
}

export function initDatabase(dbPath: string = DEFAULT_DB_PATH): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA synchronous=NORMAL');
  db.exec('PRAGMA busy_timeout=5000');
  runMigrations(db);
  return db;
}
