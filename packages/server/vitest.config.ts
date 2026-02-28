import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/generated/**',
        'src/index.ts',
        'src/cli/daemon.ts', // CLI entry / process mgmt — not unit-testable
        'src/pipeline/index.ts', // barrel re-export
        'src/pipeline/types.ts', // pure interfaces
        'src/renderer/markup/icons.ts', // pure constants
        'src/schema/resolvers/index.ts', // barrel re-export
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
