import { cleanDatabase } from './fixtures/seed';

async function globalTeardown() {
  console.log('[E2E] Cleaning test database...');
  await cleanDatabase();
  console.log('[E2E] Cleanup complete.');
}

export default globalTeardown;
