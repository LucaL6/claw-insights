import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const GENERATED_TARGETS = [
  'packages/shared/src/generated',
  'packages/server/src/schema/generated',
  'packages/web/src/generated',
];

const GENERATED_TARGETS_HINT = GENERATED_TARGETS.join(', ');

function defaultRun(command, options = {}) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function parseNameOnly(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function formatChangedFilesMessage(changedFiles) {
  return `Generated files changed:\n- ${changedFiles.join(
    '\n- ',
  )}\nStage or restore them before commit.\nTargets: ${GENERATED_TARGETS_HINT}`;
}

export function listChangedGeneratedFiles({ run = defaultRun } = {}) {
  const changed = run(`git diff --name-only -- ${GENERATED_TARGETS.join(' ')}`);
  return parseNameOnly(changed);
}

export function checkCodegenSync({ run = defaultRun } = {}) {
  try {
    run('npx graphql-codegen --config codegen.ts --check', { stdio: 'inherit' });
  } catch {
    return {
      ok: false,
      reason: 'codegen-out-of-date',
      changedFiles: [],
    };
  }

  const changedFiles = listChangedGeneratedFiles({ run });

  if (changedFiles.length > 0) {
    return {
      ok: false,
      reason: 'generated-files-dirty',
      changedFiles,
    };
  }

  return {
    ok: true,
    reason: 'ok',
    changedFiles: [],
  };
}

export function assertGeneratedFilesClean({ run = defaultRun } = {}) {
  const changedFiles = listChangedGeneratedFiles({ run });

  if (changedFiles.length > 0) {
    throw new Error(formatChangedFilesMessage(changedFiles));
  }
}

export function assertCodegenSync({ run = defaultRun } = {}) {
  const result = checkCodegenSync({ run });

  if (result.ok) {
    return;
  }

  if (result.reason === 'codegen-out-of-date') {
    throw new Error(
      `GraphQL generated files are stale. Run \`npm run codegen\`, then stage generated files before commit.\nTargets: ${GENERATED_TARGETS_HINT}`,
    );
  }

  throw new Error(formatChangedFilesMessage(result.changedFiles));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv.includes('--assert-clean') ? 'assert-clean' : 'verify';

  try {
    if (mode === 'assert-clean') {
      assertGeneratedFilesClean();
      console.log('Generated files are clean.');
    } else {
      assertCodegenSync();
      console.log('Codegen sync check passed.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
