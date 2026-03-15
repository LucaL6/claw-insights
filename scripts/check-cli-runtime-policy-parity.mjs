import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const REPO_DIR_REF = String.raw`\$(?:\{REPO_DIR\}|REPO_DIR)`;
const RELEASE_DIR_REF = String.raw`\$(?:\{RELEASE_DIR\}|RELEASE_DIR)`;
const RELEASE_BIN_TARGET_REF = String.raw`["']?${RELEASE_DIR_REF}/bin/claw-insights["']?`;

const RELEASE_BIN_COPY_PATTERN = new RegExp(
  String.raw`^cp\s+${String.raw`["']?${REPO_DIR_REF}/bin/claw-insights\.mjs["']?`}\s+${RELEASE_BIN_TARGET_REF}(?:\s+#.*)?$`,
);
const RELEASE_BIN_CHMOD_PATTERN = new RegExp(
  String.raw`^chmod\s+\+x\s+${RELEASE_BIN_TARGET_REF}(?:\s+#.*)?$`,
);
const RELEASE_BIN_HEREDOC_PATTERN = new RegExp(
  String.raw`^cat\s*>\s*${RELEASE_BIN_TARGET_REF}(?:\s+<<.*)?(?:\s+#.*)?$`,
);
const RELEASE_BIN_TARGET_PATTERN = new RegExp(RELEASE_BIN_TARGET_REF);

function extractRuntimePolicyBlock(source, fileLabel) {
  const start = source.indexOf('// RUNTIME_POLICY_BLOCK_START');
  const end = source.indexOf('// RUNTIME_POLICY_BLOCK_END');

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${fileLabel}: runtime policy marker block not found`);
  }

  return source.slice(start, end + '// RUNTIME_POLICY_BLOCK_END'.length).trim();
}

function getExecutableScriptLines(script) {
  return script
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

export function checkCliRuntimePolicyParity({
  rootBinPath = resolve(ROOT_DIR, 'bin', 'claw-insights.mjs'),
  releaseScriptPath = resolve(ROOT_DIR, 'scripts', 'build-release.sh'),
} = {}) {
  const rootBin = readFileSync(rootBinPath, 'utf8');
  const releaseScript = readFileSync(releaseScriptPath, 'utf8');
  const releaseCommands = getExecutableScriptLines(releaseScript);

  const errors = [];

  try {
    extractRuntimePolicyBlock(rootBin, rootBinPath);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  let hasCanonicalCopy = false;
  let hasCanonicalChmod = false;
  let hasHandwrittenHeredoc = false;
  let hasUnexpectedBinMutation = false;

  for (const line of releaseCommands) {
    if (RELEASE_BIN_COPY_PATTERN.test(line)) {
      hasCanonicalCopy = true;
      continue;
    }

    if (RELEASE_BIN_CHMOD_PATTERN.test(line)) {
      hasCanonicalChmod = true;
      continue;
    }

    if (RELEASE_BIN_HEREDOC_PATTERN.test(line)) {
      hasHandwrittenHeredoc = true;
      continue;
    }

    if (RELEASE_BIN_TARGET_PATTERN.test(line)) {
      hasUnexpectedBinMutation = true;
    }
  }

  if (hasHandwrittenHeredoc) {
    errors.push('Release script embeds a handwritten bin template; copy canonical bin/claw-insights.mjs instead.');
  }

  if (!hasCanonicalCopy) {
    errors.push('Release script must copy canonical bin/claw-insights.mjs into release package.');
  }

  if (!hasCanonicalChmod) {
    errors.push('Release script must mark copied bin/claw-insights as executable.');
  }

  if (hasUnexpectedBinMutation) {
    errors.push(
      'Release script must not mutate dist/release/bin/claw-insights except canonical copy + chmod.',
    );
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function assertCliRuntimePolicyParity(options = {}) {
  const result = checkCliRuntimePolicyParity(options);
  if (!result.ok) {
    throw new Error(`CLI runtime policy parity check failed:\n- ${result.errors.join('\n- ')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    assertCliRuntimePolicyParity();
    console.log('CLI runtime policy parity check passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
