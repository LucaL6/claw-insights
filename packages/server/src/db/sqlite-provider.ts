import { DatabaseSync, type StatementSync } from 'node:sqlite';

import type { Database, RunResult, SqlParam, Statement } from './database.js';

function wrapStatement(stmt: StatementSync): Statement {
  return {
    run(...params: SqlParam[]): RunResult {
      return stmt.run(...params) as unknown as RunResult;
    },
    get<T = unknown>(...params: SqlParam[]): T | undefined {
      return stmt.get(...params) as T | undefined;
    },
    all<T = unknown>(...params: SqlParam[]): T[] {
      return stmt.all(...params) as T[];
    },
  };
}

class SqliteProvider implements Database {
  private db: DatabaseSync;
  private _inTransaction = false;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode=WAL');
    this.db.exec('PRAGMA synchronous=NORMAL');
    this.db.exec('PRAGMA busy_timeout=5000');
  }

  prepare(sql: string): Statement {
    return wrapStatement(this.db.prepare(sql));
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  close(): void {
    this.db.close();
  }

  /**
   * Execute `fn` within a transaction.
   *
   * **Re-entrant:** If already inside a transaction, `fn` runs directly without
   * starting a nested transaction (no SAVEPOINT). An error thrown by the inner
   * `fn` will propagate to the outer transaction and trigger a full ROLLBACK.
   */
  transaction<T>(fn: (db: Database) => T): T {
    if (this._inTransaction) {
      return fn(this);
    }
    this._inTransaction = true;
    this.db.exec('BEGIN');
    try {
      const result = fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    } finally {
      this._inTransaction = false;
    }
  }
}

export function createSqliteDatabase(dbPath: string): Database {
  return new SqliteProvider(dbPath);
}
