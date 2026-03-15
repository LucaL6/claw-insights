import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

function extractRuntimePolicyBlock(source, fileLabel) {
  const start = source.indexOf('// RUNTIME_POLICY_BLOCK_START');
  const end = source.indexOf('// RUNTIME_POLICY_BLOCK_END');

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${fileLabel}: runtime policy marker block not found`);
  }

  return source.slice(start, end + '// RUNTIME_POLICY_BLOCK_END'.length).trim();
}

export function checkCliRuntimePolicyParity({
  rootBinPath = resolve(ROOT_DIR, 'bin', 'claw-insights.mjs'),
  releaseScriptPath = resolve(ROOT_DIR, 'scripts', 'build-release.sh'),
} = {}) {
  const rootBin = readFileSync(rootBinPath, 'utf8');
  const releaseScript = readFileSync(releaseScriptPath, 'utf8');

  const rootBlock = extractRuntimePolicyBlock(rootBin, rootBinPath);
  const releaseBlock = extractRuntimePolicyBlock(releaseScript, releaseScriptPath);

  if (rootBlock !== releaseBlock) {
    return {
      ok: false,
      errors: ['Root and release runtime policy blocks diverged. Keep them identical.'],
    };
  }

  return { ok: true, errors: [] };
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
