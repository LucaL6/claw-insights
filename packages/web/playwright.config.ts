import { defineConfig } from '@playwright/test';

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
      },
    },
    {
      command: 'npx vite --port 3211',
      port: 3211,
      reuseExistingServer: true,
    },
  ],
});
