import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'packages/server/src/schema/schema.graphql',
  generates: {
    'packages/shared/src/generated/schema-types.ts': {
      plugins: ['typescript'],
      config: {
        enumsAsTypes: true,
        skipTypename: true,
        scalars: {
          Int: 'number',
          Float: 'number',
          String: 'string',
          Boolean: 'boolean',
          JSON: 'unknown',
          JSONObject: 'unknown',
        },
      },
    },
    'packages/server/src/schema/generated/resolver-types.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../../context.js#AppContext',
        useIndexSignature: true,
        enumsAsTypes: true,
        skipTypename: true,
        scalars: {
          Int: 'number',
          Float: 'number',
          String: 'string',
          Boolean: 'boolean',
          JSON: 'unknown',
          JSONObject: 'unknown',
        },
      },
    },
    'packages/web/src/generated/': {
      documents: ['packages/web/src/graphql/**/*.ts'],
      preset: 'client',
      config: {
        enumsAsTypes: true,
        skipTypename: true,
        useTypeImports: true,
        scalars: {
          JSON: 'Record<string, unknown>',
          JSONObject: 'Record<string, unknown>',
        },
      },
    },
  },
};

export default config;
