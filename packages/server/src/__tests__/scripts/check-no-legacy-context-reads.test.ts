import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadBaseline, scanLegacyReads, writeBaseline } from '../../../scripts/check-no-legacy-context-reads.mjs';

describe('check-no-legacy-context-reads', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `legacy-gate-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('AST-based detection', () => {
    it('should detect direct ctx.sessionReader access', async () => {
      const testFile = join(testDir, 'test1.ts');
      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          const sessions = ctx.sessionReader.getAllSessions();
          return sessions;
        }
      `,
      );

      const result = await scanLegacyReads({ scope: [testFile] });

      expect(result.violations.length).toBeGreaterThan(0);
      const repoRoot = resolve(process.cwd(), '..', '..');
      expect(result.violations[0].file).toBe(relative(repoRoot, testFile));
      expect(result.violations[0].line).toBe(3); // Line with ctx.sessionReader
      expect(result.passed).toBe(false);
    });

    it('should detect destructured legacy reads', async () => {
      const testFile = join(testDir, 'test2.ts');
      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          const { aggregator, sessionReader } = ctx;
          return aggregator.getMetrics();
        }
      `,
      );

      const result = await scanLegacyReads({ scope: [testFile] });

      // Should detect destructuring that includes legacy properties
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
    });

    it('should detect aliased legacy reads', async () => {
      const testFile = join(testDir, 'test3.ts');
      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          const reader = ctx.cronReader;
          return reader.list();
        }
      `,
      );

      const result = await scanLegacyReads({ scope: [testFile] });

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
    });

    it('should detect destructured alias legacy reads', async () => {
      const testFile = join(testDir, 'test3b.ts');
      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          const { sessionReader: sr } = ctx;
          return sr.getAllSessions();
        }
      `,
      );

      const result = await scanLegacyReads({ scope: [testFile] });

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
    });

    it('should NOT flag ctx.ports access', async () => {
      const testFile = join(testDir, 'test4.ts');
      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          const sessions = ctx.ports.sessions.getAllSessions();
          return sessions;
        }
      `,
      );

      const result = await scanLegacyReads({ scope: [testFile] });

      expect(result.violations.length).toBe(0);
      expect(result.passed).toBe(true);
    });

    it('should detect multiple legacy properties', async () => {
      const testFile = join(testDir, 'test5.ts');
      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          ctx.sessionReader.getAllSessions();
          ctx.aggregator.getMetrics();
          ctx.gatewayClient.warmCache();
        }
      `,
      );

      const result = await scanLegacyReads({ scope: [testFile] });

      expect(result.violations.length).toBe(3);
      expect(result.passed).toBe(false);
    });
  });

  describe('scope filtering', () => {
    it('should only check files within scope', async () => {
      const inScopeFile = join(testDir, 'in-scope.ts');
      const outScopeFile = join(testDir, 'out-scope.ts');

      writeFileSync(
        inScopeFile,
        `
        function handler(ctx: AppContext) {
          return ctx.sessionReader.getAllSessions();
        }
      `,
      );

      writeFileSync(
        outScopeFile,
        `
        function handler(ctx: AppContext) {
          return ctx.cronReader.list();
        }
      `,
      );

      const result = await scanLegacyReads({ scope: [inScopeFile] });

      // Should only detect violation in scoped file
      expect(result.violations.length).toBe(1);
      const repoRoot = resolve(process.cwd(), '..', '..');
      expect(result.violations[0].file).toBe(relative(repoRoot, inScopeFile));
    });
  });

  describe('baseline grandfathering', () => {
    it('should pass when violations match baseline in incremental mode', async () => {
      const testFile = join(testDir, 'test6.ts');
      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          return ctx.sessionReader.getAllSessions();
        }
      `,
      );

      // Create baseline with this violation
      const baselineFile = join(testDir, 'baseline.json');
      const repoRoot = resolve(process.cwd(), '..', '..');
      const violations = [{ file: relative(repoRoot, testFile), line: 3 }];

      // Write baseline
      await writeBaseline(violations, baselineFile);

      // Scan in incremental mode
      const result = await scanLegacyReads({
        scope: [testFile],
        mode: 'incremental',
        baselineFile,
      });

      // Should pass because violation is in baseline
      expect(result.passed).toBe(true);
    });

    it('should fail when new violations are introduced in incremental mode', async () => {
      const baselineFile = join(testDir, 'baseline.json');
      const oldFile = join(testDir, 'old.ts');
      const newFile = join(testDir, 'new.ts');

      // Old violation (in baseline)
      writeFileSync(
        oldFile,
        `
        function handler(ctx: AppContext) {
          return ctx.sessionReader.getAllSessions();
        }
      `,
      );

      // Create baseline with only old violation
      const repoRoot = resolve(process.cwd(), '..', '..');
      await writeBaseline([{ file: relative(repoRoot, oldFile), line: 3 }], baselineFile);

      // New violation (not in baseline)
      writeFileSync(
        newFile,
        `
        function handler(ctx: AppContext) {
          return ctx.aggregator.getMetrics();
        }
      `,
      );

      const result = await scanLegacyReads({
        scope: [testDir],
        mode: 'incremental',
        baselineFile,
      });

      // Should fail because new file has violation not in baseline
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.file === relative(repoRoot, newFile))).toBe(true);
    });
  });

  describe('output format', () => {
    it('should return violations in file:line format', async () => {
      const testFile = join(testDir, 'test7.ts');
      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          ctx.sessionReader.getAllSessions();
          ctx.aggregator.getMetrics();
        }
      `,
      );

      const result = await scanLegacyReads({ scope: [testFile] });

      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            file: expect.any(String),
            line: expect.any(Number),
          }),
        ]),
      );
    });
  });

  describe('CLI behavior', () => {
    const scriptPath = resolve(process.cwd(), 'scripts/check-no-legacy-context-reads.mjs');

    it('should exit 1 in incremental mode when new violations exist', () => {
      const testFile = join(testDir, 'new-violation.ts');
      const baselineFile = join(testDir, 'baseline.json');

      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          return ctx.sessionReader.getAllSessions();
        }
      `,
      );
      writeFileSync(baselineFile, '[]');

      const result = spawnSync(
        process.execPath,
        [scriptPath, '--mode', 'incremental', '--scope', testFile, '--baseline-file', baselineFile],
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result.status).toBe(1);
      const repoRoot = resolve(process.cwd(), '..', '..');
      expect(result.stdout).toContain(`${relative(repoRoot, testFile)}:3`);
    });

    it('should exit 0 in incremental mode when no new violations exist', () => {
      const testFile = join(testDir, 'baseline-only.ts');
      const baselineFile = join(testDir, 'baseline.json');

      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          return ctx.aggregator.getMetrics();
        }
      `,
      );

      const repoRoot = resolve(process.cwd(), '..', '..');
      writeFileSync(baselineFile, JSON.stringify([{ file: relative(repoRoot, testFile), line: 3 }], null, 2));

      const result = spawnSync(
        process.execPath,
        [scriptPath, '--mode', 'incremental', '--scope', testFile, '--baseline-file', baselineFile],
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('No violations found');
    });

    it('should only scan the provided --scope path', () => {
      const inScopeFile = join(testDir, 'in-scope-cli.ts');
      const outScopeFile = join(testDir, 'out-of-scope-cli.ts');

      writeFileSync(
        inScopeFile,
        `
        function handler(ctx: AppContext) {
          return ctx.sessionReader.getAllSessions();
        }
      `,
      );
      writeFileSync(
        outScopeFile,
        `
        function handler(ctx: AppContext) {
          return ctx.cronReader.list();
        }
      `,
      );

      const result = spawnSync(process.execPath, [scriptPath, '--scope', inScopeFile], {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });

      expect(result.status).toBe(1);
      const repoRoot = resolve(process.cwd(), '..', '..');
      expect(result.stdout).toContain(`${relative(repoRoot, inScopeFile)}:3`);
      expect(result.stdout).not.toContain(relative(repoRoot, outScopeFile));
    });

    it('should write baseline file and exit 0 with --write-baseline', () => {
      const testFile = join(testDir, 'baseline-write.ts');
      const baselineFile = join(testDir, 'written-baseline.json');

      writeFileSync(
        testFile,
        `
        function handler(ctx: AppContext) {
          return ctx.sessionReader.getAllSessions();
        }
      `,
      );

      const result = spawnSync(
        process.execPath,
        [scriptPath, '--write-baseline', '--scope', testFile, '--baseline-file', baselineFile],
        { encoding: 'utf-8', cwd: process.cwd() },
      );

      expect(result.status).toBe(0);
      const repoRoot = resolve(process.cwd(), '..', '..');
      const expectedRelativePath = relative(repoRoot, testFile);
      const written = JSON.parse(readFileSync(baselineFile, 'utf-8')) as Array<{ file: string; line: number }>;
      expect(written).toEqual([{ file: expectedRelativePath, line: 3 }]);
    });

    it('should work correctly when executed from packages/server subdirectory', () => {
      // This test verifies the fix for Important-1: Gate script cwd sensitivity
      // The script should always use REPO_ROOT as base for scanning, not process.cwd()
      const serverDir = process.cwd(); // We're already in packages/server

      // Execute from packages/server directory (not repo root)
      const result = spawnSync(process.execPath, [scriptPath, '--mode', 'full'], {
        encoding: 'utf-8',
        cwd: serverDir, // Simulate running from packages/server
      });

      // Should still find violations (not return "No violations found" due to wrong cwd)
      // If the fix is correct, this should exit 1 and find the real violations
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain('No violations found');
      // Should contain at least one file:line output
      expect(result.stdout).toMatch(/packages\/server\/src\/.*:\d+/);
    });
  });

  describe('baseline operations', () => {
    it('should write and load baseline correctly with repo-relative paths', async () => {
      const baselineFile = join(testDir, 'baseline.json');
      const violations = [
        { file: 'packages/server/src/file1.ts', line: 10 },
        { file: 'packages/server/src/file2.ts', line: 25 },
      ];

      await writeBaseline(violations, baselineFile);
      const loaded = await loadBaseline(baselineFile);

      expect(loaded).toEqual(violations);
      expect(loaded.every((entry) => !entry.file.startsWith('/'))).toBe(true);
      expect(loaded.every((entry) => !entry.file.includes('/path/to/'))).toBe(true);
    });

    it('checked-in baseline should be real repo-relative paths only', async () => {
      const repoRoot = resolve(process.cwd(), '..', '..');
      const baselineFile = resolve(process.cwd(), 'scripts/legacy-context-baseline.json');
      const baseline = JSON.parse(readFileSync(baselineFile, 'utf-8')) as Array<{ file: string; line: number }>;

      expect(baseline.length).toBeGreaterThan(0);
      for (const entry of baseline) {
        expect(entry.file.startsWith('/')).toBe(false);
        expect(entry.file.includes('/path/to/')).toBe(false);
        expect(existsSync(resolve(repoRoot, entry.file))).toBe(true);
      }
    });
  });
});
