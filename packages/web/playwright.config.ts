import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: [
    {
      command: 'cd ../server && bun run dev',
      port: 4000,
      reuseExistingServer: true,
    },
    {
      command: 'bunx vite',
      port: 3200,
      reuseExistingServer: true,
    },
  ],
  use: {
    baseURL: 'http://localhost:3200',
  },
});
