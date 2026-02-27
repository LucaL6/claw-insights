// Root ESLint config — Hybrid monorepo setup.
// Provides shared ignores and minimal base rules.
// Full lint rules live in packages/*/eslint.config.js.
// lint-staged uses --config to point at package configs directly.
//
// This config is NOT used for linting packages — run lint from each package.
// It exists as an IDE fallback for root-level files (scripts, configs).

import eslint from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Package sources are linted by their own configs
    ignores: [
      'dist/**',
      '**/generated/**',
      '**/node_modules/**',
      'packages/web/src/**',
      'packages/server/src/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: 'error',
      'prefer-const': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
);
