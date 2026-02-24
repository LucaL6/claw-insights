import { defineConfig } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = resolve(__dir, '.e2e-test-metrics.db');

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3211',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `cd ../server && npx tsx src/index.ts`,
      port: 4111,
      reuseExistingServer: true,
      env: {
        NODE_ENV: 'test',
        CLAW_INSIGHTS_DB: TEST_DB_PATH,
      },
    },
    {
      command: 'npx vite --port 3211',
      port: 3211,
      reuseExistingServer: true,
    },
  ],
});
