import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parse } from 'yaml';

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
const release = parse(readFileSync('.github/workflows/release.yml', 'utf8'));

function getJob(workflow, key) {
  const job = workflow.jobs?.[key];
  assert.ok(job, `Missing job: ${key}`);
  return job;
}

function getStepByName(job, name) {
  const step = job.steps?.find((entry) => entry.name === name);
  assert.ok(step, `Missing step: ${name}`);
  return step;
}

function getStepByUses(job, prefix) {
  const step = job.steps?.find((entry) =>
    typeof entry.uses === 'string' ? entry.uses.startsWith(prefix) : false,
  );
  assert.ok(step, `Missing step using: ${prefix}`);
  return step;
}

function getChangeFilters(ciWorkflow) {
  const changesJob = getJob(ciWorkflow, 'changes');
  const filterStep = getStepByUses(changesJob, 'dorny/paths-filter@v3');
  const filterText = filterStep.with?.filters;
  assert.equal(typeof filterText, 'string');

  const filters = parse(filterText);
  assert.ok(filters && typeof filters === 'object', 'Invalid filters map');
  return filters;
}

test('ci has concurrency cancellation', () => {
  assert.equal(ci.concurrency?.['cancel-in-progress'], true);
  assert.match(ci.concurrency?.group ?? '', /ci-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/);
});

test('ci has path change detector job', () => {
  const changesJob = getJob(ci, 'changes');

  for (const output of ['server', 'web', 'shared', 'e2e', 'workflow']) {
    assert.ok(changesJob.outputs?.[output], `Missing changes output: ${output}`);
  }

  const filters = getChangeFilters(ci);

  for (const filterName of ['server', 'web', 'shared', 'e2e', 'workflow']) {
    assert.ok(Array.isArray(filters[filterName]), `Expected array filter: ${filterName}`);
  }

  const workflowFilter = filters.workflow;
  assert.ok(workflowFilter.includes('tsconfig.base.json'));
  assert.ok(workflowFilter.includes('eslint.config.js'));
  assert.ok(workflowFilter.includes('codegen.ts'));
});

test('ci integration runs full integration suite', () => {
  const integrationJob = getJob(ci, 'integration');
  const runStep = getStepByName(integrationJob, 'Run integration tests');
  assert.match(runStep.run ?? '', /npm run -w @claw-insights\/server test:integration/);
});

test('e2e is conditional on relevant PR changes and always runs on non-PR', () => {
  const e2eJob = getJob(ci, 'e2e');

  assert.ok(Array.isArray(e2eJob.needs));
  assert.ok(e2eJob.needs.includes('test'));
  assert.ok(e2eJob.needs.includes('changes'));

  const condition = e2eJob.if ?? '';
  assert.match(condition, /github\.event_name != 'pull_request'/);
  assert.match(condition, /needs\.changes\.outputs\.web == 'true'/);
  assert.match(condition, /needs\.changes\.outputs\.shared == 'true'/);
  assert.match(condition, /needs\.changes\.outputs\.e2e == 'true'/);
  assert.match(condition, /needs\.changes\.outputs\.workflow == 'true'/);
});

test('workflow policy test is enforced in CI', () => {
  const policyJob = getJob(ci, 'workflow-policy');
  const verifyStep = getStepByName(policyJob, 'Verify workflow policy tests');
  assert.match(verifyStep.run ?? '', /node --test scripts\/__tests__\/workflow-policy\.test\.mjs/);
});

test('ci audit blocks critical and reports high non-blocking', () => {
  const auditJob = getJob(ci, 'audit');
  const criticalStep = getStepByName(auditJob, 'npm audit (critical gate)');
  const highStep = getStepByName(auditJob, 'npm audit (high report, non-blocking)');

  assert.equal(criticalStep.run, 'npm audit --audit-level=critical --omit=dev');
  assert.match(highStep.run ?? '', /npm audit --audit-level=high --omit=dev --json/);
  assert.match(highStep.run ?? '', /::warning title=npm audit::/);
});

test('release has id-token permission for provenance', () => {
  assert.equal(release.permissions?.['id-token'], 'write');
});

test('release blocks on high vulnerability audit', () => {
  const buildJob = getJob(release, 'build');
  const gateStep = getStepByName(buildJob, 'Security gate (prod deps: high+critical)');
  assert.equal(gateStep.run, 'npm audit --audit-level=high --omit=dev');
});

test('release verifies tarball install and version before publish', () => {
  const buildJob = getJob(release, 'build');
  const installNode22Step = getStepByName(buildJob, 'Install from tarball (Node 22)');
  const verifyNode22Step = getStepByName(buildJob, 'Verify CLI version (Node 22)');
  const installNode23Step = getStepByName(buildJob, 'Install from tarball (Node 23)');
  const verifyNode23Step = getStepByName(buildJob, 'Verify CLI version (Node 23)');

  assert.equal(installNode22Step.run, 'npm install -g ./dist/claw-insights-*.tgz');
  assert.equal(installNode23Step.run, 'npm install -g ./dist/claw-insights-*.tgz');

  assert.match(verifyNode22Step.run ?? '', /EXPECTED="\$\{GITHUB_REF_NAME#v\}"/);
  assert.match(verifyNode22Step.run ?? '', /claw-insights --version/);
  assert.match(verifyNode23Step.run ?? '', /EXPECTED="\$\{GITHUB_REF_NAME#v\}"/);
  assert.match(verifyNode23Step.run ?? '', /claw-insights --version/);
});

test('release smoke-tests snapshot subcommand from installed tarball on both node versions', () => {
  const buildJob = getJob(release, 'build');
  const snapshotNode22Step = getStepByName(buildJob, 'Smoke test installed CLI snapshot subcommand (Node 22)');
  const snapshotNode23Step = getStepByName(buildJob, 'Smoke test installed CLI snapshot subcommand (Node 23)');

  assert.equal(snapshotNode22Step.run, 'bash scripts/ci/smoke-release-snapshot.sh 41151');
  assert.equal(snapshotNode23Step.run, 'bash scripts/ci/smoke-release-snapshot.sh 41153');
});

test('release npm publish uses provenance', () => {
  const publishJob = getJob(release, 'publish-npm');
  const publishStep = getStepByName(publishJob, 'Publish to npm');
  assert.match(publishStep.run ?? '', /npm publish .*--provenance/);
});
