/**
 * Shared E2E test setup: seed before all, clean after all.
 */
import { test as base } from '@playwright/test';
import { seedDatabase, cleanDatabase, getTestDbPath } from '../fixtures/seed';

export const test = base.extend<{}, { seedDb: void }>({
  seedDb: [async ({}, use) => {
    await seedDatabase();
    await use();
    await cleanDatabase();
  }, { scope: 'worker' }],
});

export { expect } from '@playwright/test';
export { getTestDbPath };
