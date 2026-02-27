import { getTestDbPath, seedDatabase } from './fixtures/seed';

async function globalSetup() {
  console.log('[E2E] Seeding test database...');
  await seedDatabase();
  console.log('[E2E] Seed complete. DB path:', getTestDbPath());
  // Set env var so the server picks up the test DB
  process.env.CLAW_INSIGHTS_DB = getTestDbPath();
}

export default globalSetup;
