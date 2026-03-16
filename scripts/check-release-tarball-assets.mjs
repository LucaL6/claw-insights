import { accessSync, constants, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const REQUIRED_ENTRIES = [
  'package/assets/openclaw-lobster.svg',
  'package/assets/fonts/Inter-Regular.ttf',
  'package/bin/claw-insights',
  'package/server/index.js',
  'package/server/cli/node-runtime.js',
  'package/web/index.html',
  'package/README.md',
  'package/LICENSE',
];

export function findMissingEntries(entries, required = REQUIRED_ENTRIES) {
  const set = new Set(entries);
  return required.filter((entry) => !set.has(entry));
}

export function checkReleaseTarballAssets(tarballPath, required = REQUIRED_ENTRIES) {
  accessSync(tarballPath);

  const listRaw = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' });
  const entries = listRaw.split(/\r?\n/).filter(Boolean);
  const missing = findMissingEntries(entries, required);
  if (missing.length > 0) {
    return { ok: false, errors: [`Missing required entries: ${missing.join(', ')}`] };
  }

  const unpackDir = mkdtempSync(resolve(tmpdir(), 'release-tarball-check-'));
  try {
    execFileSync('tar', ['-xzf', tarballPath, '-C', unpackDir, ...required]);
    const bad = required.filter((entry) => {
      const fullPath = resolve(unpackDir, entry);
      try {
        accessSync(fullPath, constants.R_OK);
        return statSync(fullPath).size <= 0;
      } catch {
        return true;
      }
    });

    if (bad.length > 0) {
      return { ok: false, errors: [`Required entries are empty/unreadable: ${bad.join(', ')}`] };
    }

    return { ok: true, errors: [] };
  } finally {
    rmSync(unpackDir, { recursive: true, force: true });
  }
}

export function assertReleaseTarballAssets(tarballPath, required = REQUIRED_ENTRIES) {
  const result = checkReleaseTarballAssets(tarballPath, required);
  if (!result.ok) {
    throw new Error(`Release tarball asset check failed:\n- ${result.errors.join('\n- ')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/check-release-tarball-assets.mjs <tarball.tgz>');
    process.exit(1);
  }
  try {
    assertReleaseTarballAssets(resolve(target));
    console.log(`Release tarball asset check passed: ${target}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
