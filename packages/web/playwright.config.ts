import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: [
    {
      command: 'cd ../server && npx tsx src/index.ts',
      port: 4000,
      reuseExistingServer: true,
    },
    {
      command: 'npx vite',
      port: 3200,
      reuseExistingServer: true,
    },
  ],
  use: {
    baseURL: 'http://localhost:3200',
  },
});
