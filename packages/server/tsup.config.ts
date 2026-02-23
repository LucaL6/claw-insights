import { defineConfig } from 'tsup';
import { builtinModules } from 'node:module';

const nodeExternals = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/parse-args.ts', 'src/cli/daemon.ts'],
  format: ['esm'],
  dts: true,
  splitting: true,
  external: [...nodeExternals, 'node:sqlite', 'express', 'graphql', 'graphql-yoga', '@resvg/resvg-js'],
});
