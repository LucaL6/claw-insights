import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const { assertCliRuntimePolicyParity, checkCliRuntimePolicyParity } = await import('../check-cli-runtime-policy-parity.mjs');

const SHARED_BLOCK = `// RUNTIME_POLICY_BLOCK_START\nconst { buildNodeArgsForServer, assertSupportedNodeVersion } = await import(runtimeHelperPath);\nassertSupportedNodeVersion(process.versions.node);\nconst nodeArgs = buildNodeArgsForServer(serverEntry, process.versions.node);\n// RUNTIME_POLICY_BLOCK_END`;

function withTempFiles(fn) {
  const base = mkdtempSync(resolve(tmpdir(), 'cli-parity-'));
  const rootBinPath = resolve(base, 'bin.mjs');
  const releaseScriptPath = resolve(base, 'build-release.sh');
  try {
    fn({ rootBinPath, releaseScriptPath });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

test('passes when root/release runtime policy blocks are identical', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, `${SHARED_BLOCK}\n`);
    writeFileSync(releaseScriptPath, `${SHARED_BLOCK}\n`);

    assert.doesNotThrow(() => {
      assertCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    });
  });
});

test('fails when runtime policy blocks diverge', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, `${SHARED_BLOCK}\n`);
    writeFileSync(
      releaseScriptPath,
      `${SHARED_BLOCK.replace('assertSupportedNodeVersion', 'assertSupportedNodeVersion /* drift */')}\n`,
    );

    const result = checkCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /diverged/i);
  });
});

test('passes for repository root/release runtime policy blocks', () => {
  assert.doesNotThrow(() => {
    assertCliRuntimePolicyParity();
  });
});
