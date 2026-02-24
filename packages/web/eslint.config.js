import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', '**/generated/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: {
          allowDefaultProject: [],
          defaultProject: 'tsconfig.app.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/consistent-type-exports': ['error', {
        fixMixedExportsWithInlineTypeSpecifier: true,
      }],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': 'error',
      'prefer-const': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'react-refresh/only-export-components': 'error',
      // Spread recommended react-hooks rules, then override specific ones to error
      ...reactHooks.configs.flat.recommended.rules,
      'react-hooks/purity': 'error',
      'react-hooks/refs': 'error',
      // Allow numbers, booleans, and nullish values in template expressions —
      // too noisy for dashboard code that interpolates metrics/counts
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
        allowNullish: true,
      }],
      // Allow dynamic delete — used extensively for URL params and filter objects
      '@typescript-eslint/no-dynamic-delete': 'off',
      // Allow defensive null checks on array access and optional chains —
      // noUncheckedIndexedAccess is not enabled, but runtime nulls are possible
      '@typescript-eslint/no-unnecessary-condition': ['error', {
        allowConstantLoopConditions: true,
      }],
    },
  },
  {
    // Config/tooling/e2e files — not in tsconfig include, disable type-aware rules
    files: ['*.config.ts', 'e2e/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },
);
