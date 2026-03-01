import { builtinModules } from 'node:module';

import { defineConfig } from 'tsup';

const nodeExternals = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/cli/parse-args.ts', 'src/cli/daemon.ts', 'src/cli/snapshot-cmd.ts'],
    format: ['esm'],
    dts: true,
    splitting: true,
    external: [...nodeExternals, 'node:sqlite', 'express', 'graphql', 'graphql-yoga', '@resvg/resvg-js'],
  },
  {
    entry: ['src/sources/collectors/scan-worker.ts'],
    format: ['esm'],
    outDir: 'dist',
    splitting: false,
    // Worker must be self-contained (no chunk deps from splitting).
    // Don't use noExternal (it overrides external in tsup).
    // Instead, rely on tsup's default bundling + explicit externals for problematic CJS deps.
    external: [...nodeExternals, 'node:sqlite'],
  },
]);
