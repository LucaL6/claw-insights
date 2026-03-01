import { defineConfig } from '@playwright/test';
import { dirname,resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dir, '.e2e-test-metrics.db');
const FIXTURES_DIR = resolve(__dir, 'e2e/fixtures');

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 30_000,
  retries: 1,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: 'http://localhost:3211',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `cd ../server && npx tsx src/index.ts`,
      port: 4111,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        CLAW_INSIGHTS_DB: TEST_DB_PATH,
        CLAW_INSIGHTS_CLI: resolve(FIXTURES_DIR, 'mock-openclaw'),
        CLAW_INSIGHTS_SESSIONS_PATH: resolve(FIXTURES_DIR, 'sessions.json'),
        CLAW_INSIGHTS_CRON_PATH: resolve(FIXTURES_DIR, 'cron-jobs.json'),
        CLAW_INSIGHTS_TRANSCRIPTS_DIR: resolve(FIXTURES_DIR, 'transcripts'),
        CLAW_INSIGHTS_DIR: FIXTURES_DIR,
      },
    },
    {
      command: 'npx vite --port 3211',
      port: 3211,
      reuseExistingServer: false,
      env: {
        CLAW_INSIGHTS_SERVER_PORT: '4111',
      },
    },
  ],
});
