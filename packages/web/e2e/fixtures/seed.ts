/**
 * E2E fixture: seed/clean DB for tests.
 * Uses a dedicated test DB path to avoid polluting real data.
 */
import { resolve, dirname } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DB_PATH = resolve(__dirname, '../../.e2e-test-metrics.db');

export function getTestDbPath(): string {
  return TEST_DB_PATH;
}

export async function seedDatabase(): Promise<void> {
  // Dynamic import to handle ESM/CJS boundary
  const { seedTestData } = await import('../../../server/src/db/seed.ts');
  const db = seedTestData(TEST_DB_PATH);
  db.close();
}

export async function cleanDatabase(): Promise<void> {
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // ignore
    }
    // Also clean WAL/SHM files
    for (const suffix of ['-wal', '-shm']) {
      const p = TEST_DB_PATH + suffix;
      if (existsSync(p)) {
        try { unlinkSync(p); } catch { /* ignore */ }
      }
    }
  }
}
