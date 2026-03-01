/** Bind parameter type — replaces node:sqlite's SQLInputValue */
export type SqlParam = string | number | bigint | null | Uint8Array;

/** Result of Statement.run() — aligned with node:sqlite StatementSync */
export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

/** Prepared statement abstraction */
export interface Statement {
  run(...params: SqlParam[]): RunResult;
  get<T = unknown>(...params: SqlParam[]): T | undefined;
  all<T = unknown>(...params: SqlParam[]): T[];
}

/** Database abstraction — hides the concrete driver */
export interface Database {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  close(): void;
  transaction<T>(fn: (db: Database) => T): T;
}
