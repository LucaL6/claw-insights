import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/generated/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/test/render.tsx', // test helper, not business code
        'src/test/setup.ts', // test setup
        'src/components/charts/core/index.ts', // barrel re-export
        'src/components/charts/metrics/index.ts', // barrel re-export
        'src/components/charts/metrics/types.ts', // pure type definitions
        'src/components/sessions/shared/types.ts', // pure type definitions
      ],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
