import { existsSync, mkdirSync, renameSync } from 'fs';
import { dirname } from 'path';

import { createChildLogger } from '../logger.js';
import type { Database } from './database.js';
import { MigrationVersionError, runMigrations } from './migrate.js';
import { createSqliteDatabase } from './sqlite-provider.js';

const log = createChildLogger('db');

export interface InitDatabaseOptions {
  dbPath: string;
  mkdir?: (path: string) => void;
  createDb?: (path: string) => Database;
}

/** Backup a DB file and its WAL/SHM sidecars */
function backupDbFiles(dbPath: string, bakPath: string): void {
  renameSync(dbPath, bakPath);
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${dbPath}${suffix}`;
    if (existsSync(sidecar)) {
      renameSync(sidecar, `${bakPath}${suffix}`);
    }
  }
}

export function initDatabase(opts: InitDatabaseOptions): Database {
  const mkdir = opts.mkdir ?? ((p: string) => mkdirSync(p, { recursive: true }));
  const createDb = opts.createDb ?? createSqliteDatabase;
  mkdir(dirname(opts.dbPath));

  let db = createDb(opts.dbPath);
  try {
    runMigrations(db);
    return db;
  } catch (err) {
    // Close the old connection before backup
    try {
      db.close();
    } catch {
      /* best-effort close */
    }

    if (err instanceof MigrationVersionError && opts.dbPath !== ':memory:') {
      const bakPath = `${opts.dbPath}.${Date.now()}.bak`;
      backupDbFiles(opts.dbPath, bakPath);
      log.warn({ bakPath, oldVersion: err.current }, 'Old DB backed up, rebuilding');
      db = createDb(opts.dbPath);
      runMigrations(db);
      return db;
    }
    throw err;
  }
}

// Re-export for convenience
export type { Database } from './database.js';
