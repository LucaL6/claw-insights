import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultModuleDir = dirname(fileURLToPath(import.meta.url));

interface ResolveOptions {
  moduleDir?: string;
  cwd?: string;
  pathExists?: (path: string) => boolean;
}

const ENV_OVERRIDES: Record<string, string> = {
  fonts: 'CLAW_INSIGHTS_FONTS_DIR',
};

export function resolveAssetDir(subdir: string, opts?: ResolveOptions): string {
  const moduleDir = opts?.moduleDir ?? defaultModuleDir;
  const cwd = opts?.cwd ?? process.cwd();
  const pathExists = opts?.pathExists ?? existsSync;

  const envKey = ENV_OVERRIDES[subdir];
  if (envKey) {
    const envVal = process.env[envKey];
    if (envVal && pathExists(envVal)) {
      return envVal;
    }
  }

  const candidates = [
    resolve(cwd, 'assets', subdir),
    resolve(moduleDir, '..', 'assets', subdir),
    resolve(moduleDir, '..', '..', 'assets', subdir),
    resolve(cwd, 'packages', 'server', 'assets', subdir),
  ];

  for (const candidate of candidates) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Asset directory '${subdir}' not found. Set ${envKey || `CLAW_INSIGHTS_${subdir.toUpperCase()}_DIR`} or check installation. Checked: ${candidates.join(', ')}`,
  );
}
