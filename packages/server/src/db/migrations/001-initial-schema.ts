import type { Migration } from '../migrate.js';

const migration: Migration = {
  version: 1,
  up: `
    -- metric_events (base + module + category/source evolution)
    CREATE TABLE IF NOT EXISTS metric_events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      type      TEXT NOT NULL,
      value     REAL,
      metadata  TEXT,
      module    TEXT,
      category  TEXT,
      source    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_type_time ON metric_events(type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_time ON metric_events(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_module ON metric_events(module);
    CREATE INDEX IF NOT EXISTS idx_events_category ON metric_events(category);

    -- token_usage_events (v7)
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

    -- system_samples (v7)
    CREATE TABLE IF NOT EXISTS system_samples (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp       TEXT NOT NULL,
      active_sessions INTEGER NOT NULL DEFAULT 0,
      cpu             REAL NOT NULL DEFAULT 0,
      memory_mb       INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_system_samples_time ON system_samples(timestamp DESC);

    -- hourly_system_samples (v7)
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

    -- message_events (v8 + v10 content_hash)
    CREATE TABLE IF NOT EXISTS message_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp    TEXT NOT NULL,
      session_key  TEXT NOT NULL,
      role         TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      UNIQUE(content_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_msg_events_time ON message_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_msg_events_session ON message_events(session_key, timestamp);

    -- kv_meta (v9)
    CREATE TABLE IF NOT EXISTS kv_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- scan_state (v11 + v12 first_timestamp_ms)
    CREATE TABLE IF NOT EXISTS scan_state (
      file_path          TEXT PRIMARY KEY,
      byte_offset        INTEGER NOT NULL DEFAULT 0,
      inode              INTEGER NOT NULL,
      mtime_ms           REAL NOT NULL,
      birth_ms           REAL NOT NULL DEFAULT 0,
      partial            TEXT NOT NULL DEFAULT '',
      first_timestamp_ms REAL
    );
  `,
};

export default migration;
