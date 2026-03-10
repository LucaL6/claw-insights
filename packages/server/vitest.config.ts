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
        'src/db/seed.ts', // demo seed data, not production code
        'src/ports/types.ts', // pure type definitions
        'src/renderer/satori-renderer.ts', // flaky worker crash (ISS-046)
        'src/platforms/mock/index.ts', // test-only mock platform
        'src/sources/collectors/transcript/types.ts', // pure type definitions
        'src/sources/collectors/transcript/index.ts', // barrel re-export (3 lines)
        'src/schema/source/index.ts', // barrel re-export (6 lines)
        'src/ports/transcript-port.ts', // pure interface (21 lines)
        'src/typings/**', // ambient type declarations
      ],
      thresholds: {
        lines: 92,
        branches: 90,
        functions: 92,
        statements: 92,
      },
    },
  },
});
