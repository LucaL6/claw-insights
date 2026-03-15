import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const {
  REQUIRED_ENTRIES,
  assertReleaseTarballAssets,
  findMissingEntries,
} = await import('../check-release-tarball-assets.mjs');

test('findMissingEntries reports missing required entries', () => {
  const result = findMissingEntries(['package/assets/fonts/Inter-Regular.ttf'], [
    'package/assets/openclaw-lobster.svg',
  ]);
  assert.deepEqual(result, ['package/assets/openclaw-lobster.svg']);
});

test('required entries include release runtime chain files', () => {
  assert.ok(REQUIRED_ENTRIES.includes('package/bin/claw-insights'));
  assert.ok(REQUIRED_ENTRIES.includes('package/server/cli/node-runtime.js'));
});

function createTarball({ omit = [], empty = [] } = {}) {
  const base = mkdtempSync(resolve(tmpdir(), 'release-tarball-'));
  const pkgDir = resolve(base, 'package');
  const tarPath = resolve(base, 'artifact.tgz');

  for (const entry of REQUIRED_ENTRIES) {
    if (omit.includes(entry)) continue;
    const target = resolve(base, entry);
    mkdirSync(resolve(target, '..'), { recursive: true });
    writeFileSync(target, empty.includes(entry) ? '' : `content:${entry}`);
  }

  execFileSync('tar', ['-czf', tarPath, '-C', base, 'package']);
  return { base, tarPath };
}

test('passes for tarball containing all required non-empty entries', () => {
  const ctx = createTarball();
  try {
    assert.doesNotThrow(() => assertReleaseTarballAssets(ctx.tarPath));
  } finally {
    rmSync(ctx.base, { recursive: true, force: true });
  }
});

test('fails when required entry is missing', () => {
  const missing = 'package/assets/openclaw-lobster.svg';
  const ctx = createTarball({ omit: [missing] });
  try {
    assert.throws(() => assertReleaseTarballAssets(ctx.tarPath), /Missing required entries/);
  } finally {
    rmSync(ctx.base, { recursive: true, force: true });
  }
});

test('fails when required entry is empty', () => {
  const emptyEntry = 'package/server/index.js';
  const ctx = createTarball({ empty: [emptyEntry] });
  try {
    assert.throws(() => assertReleaseTarballAssets(ctx.tarPath), /empty\/unreadable/);
  } finally {
    rmSync(ctx.base, { recursive: true, force: true });
  }
});
