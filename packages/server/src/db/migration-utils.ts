import type { Database } from './database.js';

/**
 * Check if a column exists on a table.
 * Only for use within migration files.
 */
export function hasColumn(db: Database, table: string, column: string): boolean {
  const info = db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return info.some((c) => c.name === column);
}
