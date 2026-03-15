import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const { assertCliRuntimePolicyParity, checkCliRuntimePolicyParity } = await import('../check-cli-runtime-policy-parity.mjs');

const ROOT_BIN_WITH_POLICY = `#!/usr/bin/env node
// RUNTIME_POLICY_BLOCK_START
const { buildNodeArgsForServer, assertSupportedNodeVersion } = await import(runtimeHelperPath);
assertSupportedNodeVersion(process.versions.node);
const nodeArgs = buildNodeArgsForServer(serverEntry, process.versions.node);
// RUNTIME_POLICY_BLOCK_END
`;

const RELEASE_SCRIPT_COPYING_BIN = `#!/usr/bin/env bash
cp "$REPO_DIR/bin/claw-insights.mjs" "$RELEASE_DIR/bin/claw-insights"
chmod +x "$RELEASE_DIR/bin/claw-insights"
`;

const RELEASE_SCRIPT_COPYING_BIN_VARIANT = `#!/usr/bin/env bash
cp   '$REPO_DIR/bin/claw-insights.mjs'   "$RELEASE_DIR/bin/claw-insights"
chmod   +x   '$RELEASE_DIR/bin/claw-insights'
`;

const RELEASE_SCRIPT_COPYING_BIN_BRACED = `#!/usr/bin/env bash
cp "\${REPO_DIR}/bin/claw-insights.mjs" "\${RELEASE_DIR}/bin/claw-insights" # canonical
chmod +x "\${RELEASE_DIR}/bin/claw-insights" # keep executable
`;

const RELEASE_SCRIPT_WITH_COMMENTED_COPY = `#!/usr/bin/env bash
# cp "$REPO_DIR/bin/claw-insights.mjs" "$RELEASE_DIR/bin/claw-insights"
# chmod +x "$RELEASE_DIR/bin/claw-insights"
echo "build"
`;

const RELEASE_SCRIPT_WITH_HEREDOC = `#!/usr/bin/env bash
cat > "$RELEASE_DIR/bin/claw-insights" << 'ENTRY'
#!/usr/bin/env node
ENTRY
chmod +x "$RELEASE_DIR/bin/claw-insights"
`;

const RELEASE_SCRIPT_WITH_HEREDOC_ALT = `#!/usr/bin/env bash
cp "$REPO_DIR/bin/claw-insights.mjs" "$RELEASE_DIR/bin/claw-insights"
cat << 'ENTRY' > "$RELEASE_DIR/bin/claw-insights"
#!/usr/bin/env node
ENTRY
chmod +x "$RELEASE_DIR/bin/claw-insights"
`;

const RELEASE_SCRIPT_WITH_NON_CANONICAL_REWRITE = `#!/usr/bin/env bash
cp "$REPO_DIR/bin/claw-insights.mjs" "$RELEASE_DIR/bin/claw-insights"
cp "$REPO_DIR/bin/not-canonical.mjs" "$RELEASE_DIR/bin/claw-insights"
chmod +x "$RELEASE_DIR/bin/claw-insights"
`;

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

test('passes when root bin has runtime policy block and release script copies canonical bin', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, ROOT_BIN_WITH_POLICY);
    writeFileSync(releaseScriptPath, RELEASE_SCRIPT_COPYING_BIN);

    assert.doesNotThrow(() => {
      assertCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    });
  });
});

test('passes with equivalent spacing/quote variants for canonical copy + chmod commands', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, ROOT_BIN_WITH_POLICY);
    writeFileSync(releaseScriptPath, RELEASE_SCRIPT_COPYING_BIN_VARIANT);

    assert.doesNotThrow(() => {
      assertCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    });
  });
});

test('passes with ${REPO_DIR}/${RELEASE_DIR} command variants', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, ROOT_BIN_WITH_POLICY);
    writeFileSync(releaseScriptPath, RELEASE_SCRIPT_COPYING_BIN_BRACED);

    assert.doesNotThrow(() => {
      assertCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    });
  });
});

test('fails when cp/chmod appear only in comments', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, ROOT_BIN_WITH_POLICY);
    writeFileSync(releaseScriptPath, RELEASE_SCRIPT_WITH_COMMENTED_COPY);

    const result = checkCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /copy canonical bin/i);
    assert.match(result.errors.join('\n'), /mark copied bin/i);
  });
});

test('fails when release script still embeds heredoc bin template', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, ROOT_BIN_WITH_POLICY);
    writeFileSync(releaseScriptPath, RELEASE_SCRIPT_WITH_HEREDOC);

    const result = checkCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /heredoc|handwritten|copy canonical/i);
  });
});

test('fails when release script rewrites bin via alternate heredoc form', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, ROOT_BIN_WITH_POLICY);
    writeFileSync(releaseScriptPath, RELEASE_SCRIPT_WITH_HEREDOC_ALT);

    const result = checkCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /must not mutate|handwritten|heredoc/i);
  });
});

test('fails when release script rewrites bin with non-canonical copy command', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, ROOT_BIN_WITH_POLICY);
    writeFileSync(releaseScriptPath, RELEASE_SCRIPT_WITH_NON_CANONICAL_REWRITE);

    const result = checkCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /must not mutate/i);
  });
});

test('fails when release script does not copy canonical root bin', () => {
  withTempFiles(({ rootBinPath, releaseScriptPath }) => {
    writeFileSync(rootBinPath, ROOT_BIN_WITH_POLICY);
    writeFileSync(
      releaseScriptPath,
      '#!/usr/bin/env bash\necho "build"\nchmod +x "$RELEASE_DIR/bin/claw-insights"\n',
    );

    const result = checkCliRuntimePolicyParity({ rootBinPath, releaseScriptPath });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /copy canonical bin/i);
  });
});

test('passes for repository root bin + release script', () => {
  assert.doesNotThrow(() => {
    assertCliRuntimePolicyParity();
  });
});
