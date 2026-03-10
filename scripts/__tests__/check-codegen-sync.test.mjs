import assert from 'node:assert/strict';
import test from 'node:test';

const { assertCodegenSync, assertGeneratedFilesClean, checkCodegenSync } =
  await import('../check-codegen-sync.mjs');

function createRunMock({ codegenFails = false, dirtyDiff = '' } = {}) {
  return (command) => {
    if (command.includes('graphql-codegen') && command.includes('--check')) {
      if (codegenFails) {
        const error = new Error('codegen check failed');
        error.status = 1;
        throw error;
      }
      return '';
    }

    if (command.startsWith('git diff --name-only --')) {
      return dirtyDiff;
    }

    throw new Error(`Unexpected command: ${command}`);
  };
}

test('returns failure when graphql-codegen --check fails', () => {
  const result = checkCodegenSync({ run: createRunMock({ codegenFails: true }) });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'codegen-out-of-date');
});

test('returns failure when generated files are dirty', () => {
  const diff = ['packages/web/src/generated/gql.ts', 'packages/web/src/generated/graphql.ts'].join('\n');
  const result = checkCodegenSync({ run: createRunMock({ dirtyDiff: diff }) });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'generated-files-dirty');
  assert.deepEqual(result.changedFiles, [
    'packages/web/src/generated/gql.ts',
    'packages/web/src/generated/graphql.ts',
  ]);
});

test('returns success when codegen is up to date and generated files are clean', () => {
  const result = checkCodegenSync({ run: createRunMock() });
  assert.deepEqual(result, { ok: true, reason: 'ok', changedFiles: [] });
});

test('assertCodegenSync throws with actionable message when generated files are dirty', () => {
  const diff = 'packages/web/src/generated/gql.ts';
  assert.throws(
    () => assertCodegenSync({ run: createRunMock({ dirtyDiff: diff }) }),
    /Generated files changed/,
  );
});

test('assertGeneratedFilesClean throws when generated files are dirty', () => {
  const diff = 'packages/server/src/schema/generated/resolver-types.ts';
  assert.throws(
    () => assertGeneratedFilesClean({ run: createRunMock({ dirtyDiff: diff }) }),
    /Generated files changed/,
  );
});

test('assertGeneratedFilesClean passes when generated files are clean', () => {
  assert.doesNotThrow(() => assertGeneratedFilesClean({ run: createRunMock() }));
});
