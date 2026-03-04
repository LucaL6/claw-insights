import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB_DIR = resolve(ROOT_DIR, 'packages/web/public/logo');
const SERVER_DIR = resolve(ROOT_DIR, 'packages/server/assets/logo');

const { ALLOWED, assertAssetsParity, checkAssetsParity } = await import('../check-assets-parity.mjs');

function withTempLogoDirs(fn) {
  const base = mkdtempSync(resolve(tmpdir(), 'assets-parity-'));
  const webDir = resolve(base, 'web/logo');
  const serverDir = resolve(base, 'server/logo');
  mkdirSync(webDir, { recursive: true });
  mkdirSync(serverDir, { recursive: true });

  try {
    fn({ webDir, serverDir });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

function writeAllowedFiles(webDir, serverDir, content = 'same-bytes') {
  for (const file of ALLOWED) {
    writeFileSync(resolve(webDir, file), content);
    writeFileSync(resolve(serverDir, file), content);
  }
}

test('repository logo directories satisfy whitelist and hash parity', () => {
  assert.doesNotThrow(() => {
    assertAssetsParity({ webDir: WEB_DIR, serverDir: SERVER_DIR });
  });
});

test('fails when unexpected files are present', () => {
  withTempLogoDirs(({ webDir, serverDir }) => {
    writeAllowedFiles(webDir, serverDir);
    writeFileSync(resolve(webDir, 'extra.svg'), 'unexpected');

    const result = checkAssetsParity({ webDir, serverDir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Unexpected files in web/);
  });
});

test('fails when an allowed file is missing', () => {
  withTempLogoDirs(({ webDir, serverDir }) => {
    writeAllowedFiles(webDir, serverDir);
    rmSync(resolve(serverDir, 'favicon.svg'));

    const result = checkAssetsParity({ webDir, serverDir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Missing files in server/);
  });
});

test('fails when same filename has different bytes', () => {
  withTempLogoDirs(({ webDir, serverDir }) => {
    writeAllowedFiles(webDir, serverDir);
    writeFileSync(resolve(serverDir, 'icon-dark.svg'), 'different-content');

    const result = checkAssetsParity({ webDir, serverDir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Hash mismatch for icon-dark\.svg/);
  });
});
