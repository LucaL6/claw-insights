import { defineConfig } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dirname, '.e2e-test-metrics.db');

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3200',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `CLAW_INSIGHTS_DB=${TEST_DB_PATH} cd ../server && npx tsx src/index.ts`,
      port: 4000,
      reuseExistingServer: true,
      env: {
        CLAW_INSIGHTS_DB: TEST_DB_PATH,
      },
    },
    {
      command: 'npx vite',
      port: 3200,
      reuseExistingServer: true,
    },
  ],
});
