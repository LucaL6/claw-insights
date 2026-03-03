#!/usr/bin/env node
/**
 * AST-based legacy context read detector with baseline grandfathering.
 * 
 * Usage:
 *   node check-no-legacy-context-reads.mjs [--scope <paths...>] [--mode incremental] [--write-baseline]
 * 
 * @module check-no-legacy-context-reads
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globSync } from 'glob';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const DEFAULT_BASELINE_PATH = resolve(__dirname, 'legacy-context-baseline.json');

/**
 * List of legacy context properties that should not be accessed directly.
 * These should be accessed via ctx.ports instead.
 */
const LEGACY_PROPERTIES = [
  'sessionReader',
  'cronReader',
  'aggregator',
  'gatewayClient',
  'systemInfoService',
  'db',
  'spawnTracker',
  'systemSampler',
  'dataValidator',
  'dataRetention',
  'lifetimeScanner',
  'tokenBus',
  'messageBus',
  'logTailer'
];

/**
 * Scan for legacy context reads using TypeScript AST.
 * @param {object} options
 * @param {string[]} [options.scope] - Paths to check
 * @param {string} [options.mode] - 'full' or 'incremental'
 * @param {string} [options.baselineFile] - Path to baseline file
 * @returns {Promise<{violations: Array<{file: string, line: number}>, passed: boolean}>}
 */
export async function scanLegacyReads(options = {}) {
  const { scope = [], mode = 'full', baselineFile = DEFAULT_BASELINE_PATH } = options;
  
  // Find files to scan - always use REPO_ROOT as cwd for consistent behavior
  const files = scope.length > 0 
    ? expandScope(scope)
    : globSync('packages/server/src/**/*.ts', { cwd: REPO_ROOT, absolute: true, ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.spec.ts'] });
  
  const violations = [];
  
  for (const file of files) {
    const fileViolations = scanFile(file);
    violations.push(...fileViolations);
  }
  
  // In incremental mode, compare against baseline
  if (mode === 'incremental') {
    const baseline = await loadBaseline(baselineFile);
    const newViolations = findNewViolations(violations, baseline);
    
    return {
      violations: newViolations,
      passed: newViolations.length === 0
    };
  }
  
  return {
    violations,
    passed: violations.length === 0
  };
}

/**
 * Expand scope paths (handle directories and globs).
 * @param {string[]} scope
 * @returns {string[]}
 */
function expandScope(scope) {
  const files = new Set();
  
  for (const path of scope) {
    if (path.includes('*')) {
      // It's a glob - use REPO_ROOT as cwd for consistency, get absolute paths
      const matches = globSync(path, { cwd: REPO_ROOT, absolute: true });
      matches.forEach(f => files.add(f));
    } else {
      // Resolve path: try relative to cwd first, then relative to REPO_ROOT
      let resolvedPath;
      if (isAbsolute(path)) {
        resolvedPath = path;
      } else if (existsSync(path)) {
        // Path exists relative to cwd
        resolvedPath = resolve(path);
      } else if (existsSync(resolve(REPO_ROOT, path))) {
        // Path exists relative to REPO_ROOT
        resolvedPath = resolve(REPO_ROOT, path);
      } else {
        // Path doesn't exist, skip
        continue;
      }
      
      // Check if it's a directory or file
      const stat = statSync(resolvedPath);
      
      if (stat.isDirectory()) {
        // Scan directory for .ts files - use absolute paths
        const matches = globSync(`${resolvedPath}/**/*.ts`, { 
          absolute: true,
          ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.spec.ts'] 
        });
        matches.forEach(f => files.add(f));
      } else if (stat.isFile()) {
        // It's a file - store as absolute path
        files.add(resolvedPath);
      }
    }
  }
  
  return Array.from(files);
}

/**
 * Scan a single file for legacy context reads.
 * @param {string} filePath
 * @returns {Array<{file: string, line: number}>}
 */
function scanFile(filePath) {
  const violations = [];
  const normalizedFilePath = toRepoRelativePath(filePath);
  
  try {
    const source = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true
    );
    
    function visit(node) {
      // Check for direct property access: ctx.sessionReader
      if (ts.isPropertyAccessExpression(node)) {
        if (isLegacyContextAccess(node)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({ file: normalizedFilePath, line: line + 1 });
        }
      }
      
      // Check for destructuring: const { sessionReader } = ctx / const { sessionReader: sr } = ctx
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isObjectBindingPattern(node.name) && isContextIdentifier(node.initializer)) {
          for (const element of node.name.elements) {
            if (!ts.isBindingElement(element)) {
              continue;
            }

            // Shorthand: { sessionReader } => element.name
            // Alias: { sessionReader: sr } => element.propertyName
            const propName =
              element.propertyName && ts.isIdentifier(element.propertyName)
                ? element.propertyName.text
                : ts.isIdentifier(element.name)
                  ? element.name.text
                  : null;

            if (propName && LEGACY_PROPERTIES.includes(propName)) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(element.getStart());
              violations.push({ file: normalizedFilePath, line: line + 1 });
            }
          }
        }
      }
      
      ts.forEachChild(node, visit);
    }
    
    visit(sourceFile);
  } catch (err) {
    // Skip files that can't be parsed (e.g., not TypeScript)
    console.error(`Failed to parse ${filePath}: ${err.message}`);
  }
  
  return violations;
}

/**
 * Check if a property access is a legacy context access.
 * @param {ts.PropertyAccessExpression} node
 * @returns {boolean}
 */
function isLegacyContextAccess(node) {
  // Check if property is a legacy property
  const propertyName = node.name.text;
  if (!LEGACY_PROPERTIES.includes(propertyName)) {
    return false;
  }
  
  // Check if the object is 'ctx' or something that looks like context
  const obj = node.expression;
  
  // Direct: ctx.sessionReader
  if (ts.isIdentifier(obj) && isContextIdentifier(obj)) {
    return true;
  }
  
  // Chained: req.ctx.sessionReader (where intermediate is ctx)
  if (ts.isPropertyAccessExpression(obj) && isContextIdentifier(obj.name)) {
    return true;
  }
  
  return false;
}

/**
 * Check if an identifier looks like a context variable.
 * @param {ts.Node} node
 * @returns {boolean}
 */
function isContextIdentifier(node) {
  if (ts.isIdentifier(node)) {
    const name = node.text;
    return name === 'ctx' || name === 'context';
  }
  return false;
}

function toRepoRelativePath(filePath) {
  if (!isAbsolute(filePath)) {
    return filePath.split('\\').join('/');
  }

  return relative(REPO_ROOT, filePath).split('\\').join('/');
}

/**
 * Find violations that are not in the baseline.
 * @param {Array<{file: string, line: number}>} violations
 * @param {Array<{file: string, line: number}>} baseline
 * @returns {Array<{file: string, line: number}>}
 */
function findNewViolations(violations, baseline) {
  const baselineSet = new Set(
    baseline.map(v => `${v.file}:${v.line}`)
  );
  
  return violations.filter(v => {
    const key = `${v.file}:${v.line}`;
    return !baselineSet.has(key);
  });
}

/**
 * Write baseline to file.
 * @param {Array<{file: string, line: number}>} violations
 * @param {string} [baselineFile]
 * @returns {Promise<void>}
 */
export async function writeBaseline(violations, baselineFile = DEFAULT_BASELINE_PATH) {
  const normalized = violations.map(v => ({
    ...v,
    file: toRepoRelativePath(v.file)
  }));
  writeFileSync(baselineFile, JSON.stringify(normalized, null, 2), 'utf-8');
}

/**
 * Load baseline from file.
 * @param {string} [baselineFile]
 * @returns {Promise<Array<{file: string, line: number}>>}
 */
export async function loadBaseline(baselineFile = DEFAULT_BASELINE_PATH) {
  if (!existsSync(baselineFile)) {
    return [];
  }
  
  const content = readFileSync(baselineFile, 'utf-8');
  const parsed = JSON.parse(content);
  return parsed.map(v => ({
    ...v,
    file: toRepoRelativePath(v.file)
  }));
}

function parseCliArgs(argv) {
  const options = {
    mode: 'full',
    scope: [],
    writeBaseline: false,
    baselineFile: DEFAULT_BASELINE_PATH
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--mode') {
      options.mode = argv[i + 1] ?? 'full';
      i += 1;
      continue;
    }

    if (arg === '--scope') {
      const scopeArg = argv[i + 1];
      if (scopeArg) {
        options.scope.push(scopeArg);
      }
      i += 1;
      continue;
    }

    if (arg === '--write-baseline') {
      options.writeBaseline = true;
      continue;
    }

    if (arg === '--baseline-file') {
      options.baselineFile = argv[i + 1] ?? DEFAULT_BASELINE_PATH;
      i += 1;
    }
  }

  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);

  if (options.writeBaseline) {
    const result = await scanLegacyReads({
      scope: options.scope,
      mode: 'full',
      baselineFile: options.baselineFile
    });

    await writeBaseline(result.violations, options.baselineFile);
    console.log(`Baseline written to ${options.baselineFile}`);
    return 0;
  }

  const result = await scanLegacyReads({
    scope: options.scope,
    mode: options.mode,
    baselineFile: options.baselineFile
  });

  if (result.violations.length > 0) {
    for (const violation of result.violations) {
      console.log(`${violation.file}:${violation.line}`);
    }
    return 1;
  }

  console.log('No violations found');
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().then((exitCode) => {
    process.exit(exitCode);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
