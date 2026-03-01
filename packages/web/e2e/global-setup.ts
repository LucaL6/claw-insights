import { cleanDatabase, getTestDbPath, seedDatabase } from './fixtures/seed';

async function globalSetup() {
  await cleanDatabase();
  console.log('[E2E] Seeding test database...');
  await seedDatabase();
  console.log('[E2E] Seed complete. DB path:', getTestDbPath());
}

export default globalSetup;
