import { createChildLogger } from '../logger.js';
import type { Database } from './database.js';
import migration001 from './migrations/001-initial-schema.js';

const log = createChildLogger('db:migrate');

export interface Migration {
  version: number;
  up: string | ((db: Database) => void);
}

const MIGRATIONS: Migration[] = [migration001];
const MAX_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export class MigrationVersionError extends Error {
  constructor(
    public readonly current: number,
    public readonly max: number,
  ) {
    super(`DB schema version ${current} > max migration ${max}. Needs rebuild.`);
  }
}

export function runMigrations(db: Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get<{ v: number | null }>();
  const current = row?.v ?? 0;

  if (current > MAX_VERSION) {
    throw new MigrationVersionError(current, MAX_VERSION);
  }

  for (const m of MIGRATIONS) {
    if (m.version > current) {
      // NOTE: Migrations manage transactions directly via exec('BEGIN/COMMIT/ROLLBACK')
      // rather than db.transaction() because they are bootstrap infrastructure that
      // runs before the DB is fully initialized. Do NOT call db.transaction() inside
      // migration `up` functions — it would bypass this explicit transaction boundary.
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
