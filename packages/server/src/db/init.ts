import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('db');
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

function migrationContentHash(timestamp: string, sessionKey: string, role: string): string {
  return createHash('sha256').update(`${timestamp}|${sessionKey}|${role}`).digest('hex').slice(0, 16);
}

export const MIGRATIONS: Migration[] = [
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
        const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table) as
          | { name: string }
          | undefined;
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

      log.info('v5 sanity check passed — all tables and columns verified');
    },
  },
  {
    version: 6,
    up: (db) => {
      if (!hasColumn(db, 'model_token_samples', 'token_delta_k')) {
        db.exec('ALTER TABLE model_token_samples ADD COLUMN token_delta_k REAL NOT NULL DEFAULT 0');
      }
      log.info('v6: added token_delta_k to model_token_samples');
    },
  },
  {
    version: 7,
    up: (db) => {
      // 1. New tables
      db.exec(`
        CREATE TABLE IF NOT EXISTS token_usage_events (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp       TEXT NOT NULL,
          session_key     TEXT NOT NULL,
          model           TEXT NOT NULL,
          input_tokens    INTEGER NOT NULL DEFAULT 0,
          output_tokens   INTEGER NOT NULL DEFAULT 0,
          cache_read      INTEGER NOT NULL DEFAULT 0,
          cache_write     INTEGER NOT NULL DEFAULT 0,
          UNIQUE(timestamp, session_key, model)
        );
        CREATE INDEX IF NOT EXISTS idx_token_usage_time ON token_usage_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage_events(model, timestamp);

        CREATE TABLE IF NOT EXISTS system_samples (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp       TEXT NOT NULL,
          active_sessions INTEGER NOT NULL DEFAULT 0,
          cpu             REAL NOT NULL DEFAULT 0,
          memory_mb       INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_system_samples_time ON system_samples(timestamp DESC);

        CREATE TABLE IF NOT EXISTS hourly_system_samples (
          id                    INTEGER PRIMARY KEY AUTOINCREMENT,
          hour                  TEXT NOT NULL,
          active_sessions_max   INTEGER NOT NULL DEFAULT 0,
          active_sessions_avg   REAL NOT NULL DEFAULT 0,
          cpu_avg               REAL NOT NULL DEFAULT 0,
          cpu_max               REAL NOT NULL DEFAULT 0,
          memory_mb_avg         REAL NOT NULL DEFAULT 0,
          memory_mb_max         INTEGER NOT NULL DEFAULT 0,
          sample_count          INTEGER NOT NULL DEFAULT 0
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_system_hour ON hourly_system_samples(hour);
      `);

      // 2. Migrate system metrics history
      db.exec(`
        INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb)
        SELECT timestamp, active_sessions, cpu, memory_mb FROM metric_samples
      `);
      db.exec(`
        INSERT INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
        SELECT hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count
        FROM hourly_metric_samples
      `);

      // 3. Rename old tables (with existence checks for partial-migration safety)
      const tablesToRename = [
        ['metric_samples', '_deprecated_metric_samples'],
        ['model_token_samples', '_deprecated_model_token_samples'],
        ['hourly_metric_samples', '_deprecated_hourly_metric_samples'],
        ['hourly_model_tokens', '_deprecated_hourly_model_tokens'],
      ];
      for (const [src, dst] of tablesToRename) {
        const srcExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(src) as
          | { name: string }
          | undefined;
        const dstExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(dst) as
          | { name: string }
          | undefined;
        if (srcExists && !dstExists) {
          db.exec(`ALTER TABLE ${src} RENAME TO ${dst}`);
        } else if (!srcExists) {
          log.warn({ table: src }, 'v7: table not found for rename, skipping');
        }
      }

      log.info('v7: token_usage_events + system_samples created, old tables deprecated');
    },
  },
  {
    version: 8,
    up: `
      CREATE TABLE IF NOT EXISTS message_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp   TEXT NOT NULL,
        session_key TEXT NOT NULL,
        role        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_msg_events_time ON message_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_msg_events_session ON message_events(session_key, timestamp);
    `,
  },
  {
    version: 9,
    up: `
      CREATE TABLE IF NOT EXISTS kv_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 10,
    up: (db) => {
      const beforeCount = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;

      db.exec(`
        CREATE TABLE message_events_new (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp    TEXT NOT NULL,
          session_key  TEXT NOT NULL,
          role         TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          UNIQUE(content_hash)
        );
      `);

      const rows = db
        .prepare(
          `SELECT timestamp, session_key, role
           FROM message_events
           GROUP BY timestamp, session_key, role`,
        )
        .all() as Array<{ timestamp: string; session_key: string; role: string }>;

      const insert = db.prepare(
        'INSERT OR IGNORE INTO message_events_new (timestamp, session_key, role, content_hash) VALUES (?, ?, ?, ?)',
      );
      for (const row of rows) {
        const hash = migrationContentHash(row.timestamp, row.session_key, row.role);
        insert.run(row.timestamp, row.session_key, row.role, hash);
      }

      const afterCount = (db.prepare('SELECT COUNT(*) as cnt FROM message_events_new').get() as { cnt: number }).cnt;
      const dupsRemoved = beforeCount - afterCount;

      db.exec('DROP TABLE message_events');
      db.exec('ALTER TABLE message_events_new RENAME TO message_events');
      db.exec('CREATE INDEX IF NOT EXISTS idx_msg_events_time ON message_events(timestamp)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_msg_events_session ON message_events(session_key, timestamp)');

      // Clear all rows — LifetimeScanner.scanAll() will repopulate with correct
      // role|lineHash hashes on first startup. Migration-backfilled hashes use
      // role-only discriminator which is incompatible with runtime dedup key.
      db.exec('DELETE FROM message_events');

      log.info(
        { beforeCount, dupsRemoved },
        'v10: message_events rebuilt with content_hash UNIQUE (cleared for rescan)',
      );
    },
  },
  {
    version: 11,
    up: `
      CREATE TABLE IF NOT EXISTS scan_state (
        file_path   TEXT PRIMARY KEY,
        byte_offset INTEGER NOT NULL DEFAULT 0,
        inode       INTEGER NOT NULL,
        mtime_ms    REAL NOT NULL,
        birth_ms    REAL NOT NULL DEFAULT 0,
        partial     TEXT NOT NULL DEFAULT ''
      );
    `,
  },
  {
    version: 12,
    up: (db) => {
      if (!hasColumn(db, 'scan_state', 'first_timestamp_ms')) {
        db.exec('ALTER TABLE scan_state ADD COLUMN first_timestamp_ms REAL');
      }
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
        log.info({ version: m.version }, 'migration applied');
      } catch (err) {
        db.exec('ROLLBACK');
        log.error({ err, version: m.version }, 'migration failed');
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
