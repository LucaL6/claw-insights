import eslint from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', '**/generated/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
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
      // Relaxed strict rules — too noisy for existing codebase
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Too noisy: {} from JSON/health responses, structural types in templates
      '@typescript-eslint/restrict-template-expressions': 'off',
      // Unsafe-* rules: codebase uses `any` in some infra layers; suppress for now
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Too aggressive for defensive null checks on optional chains
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // Allow void expressions in arrow shorthands
      '@typescript-eslint/no-confusing-void-expression': ['error', {
        ignoreArrowShorthand: true,
        ignoreVoidOperator: true,
      }],
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      // Types from other packages sometimes resolve as 'error' types
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      // Intentional pattern: get<T>(name): T for typed resource access
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      // DESIGN-065: warn on deprecated ctx.* access, gate new violations
      '@typescript-eslint/no-deprecated': 'warn',
    },
  },
  {
    // Context definition file — allowed to use deprecated for backward compat
    files: ['src/context.ts'],
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
  {
    files: ['src/cli/**/*.ts', 'src/index.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Config/tooling files — not in tsconfig include, disable type-aware rules
    files: ['*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Test files — disable type-checked and strict rules
    files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        program: null,
        project: false,
      },
    },
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
