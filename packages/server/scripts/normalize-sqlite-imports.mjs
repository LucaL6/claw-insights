#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(scriptDir, '..', 'dist');

function collectJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectJsFiles(fullPath));
      continue;
    }

    if (entry.isFile() && /\.(?:c|m)?js$/u.test(entry.name)) {
      out.push(fullPath);
    }
  }
  return out;
}

function parseSourceFile(filePath, source) {
  return ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

function createSpecifierReplacement(source, sourceFile, literalNode) {
  const start = literalNode.getStart(sourceFile);
  const end = literalNode.end;
  const quote = source[start] === "'" ? "'" : '"';
  return { start, end, text: `${quote}node:sqlite${quote}` };
}

function collectSqliteSpecifierReplacements(source, filePath) {
  const sourceFile = parseSourceFile(filePath, source);
  const replacements = [];
  const seen = new Set();

  function addReplacement(literalNode) {
    if (!ts.isStringLiteralLike(literalNode) || literalNode.text !== 'sqlite') {
      return;
    }

    const replacement = createSpecifierReplacement(source, sourceFile, literalNode);
    const key = `${replacement.start}:${replacement.end}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    replacements.push(replacement);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      addReplacement(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      addReplacement(node.moduleSpecifier);
    } else if (ts.isCallExpression(node)) {
      const firstArg = node.arguments[0];
      if (firstArg) {
        if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
          addReplacement(firstArg);
        }
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          addReplacement(firstArg);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return replacements.sort((a, b) => b.start - a.start);
}

function applyReplacements(source, replacements) {
  let next = source;
  for (const replacement of replacements) {
    next = `${next.slice(0, replacement.start)}${replacement.text}${next.slice(replacement.end)}`;
  }
  return next;
}

function collectBareSqliteSpecifiers(source, filePath) {
  const sourceFile = parseSourceFile(filePath, source);
  const bare = [];

  function recordIfBare(literalNode, kind) {
    if (ts.isStringLiteralLike(literalNode) && literalNode.text === 'sqlite') {
      bare.push(kind);
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      recordIfBare(node.moduleSpecifier, 'import');
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      recordIfBare(node.moduleSpecifier, 'export');
    } else if (ts.isCallExpression(node)) {
      const firstArg = node.arguments[0];
      if (firstArg) {
        if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
          recordIfBare(firstArg, 'require');
        }
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          recordIfBare(firstArg, 'import()');
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return bare;
}

const files = collectJsFiles(distDir);
let changedFiles = 0;
const unresolved = [];

for (const filePath of files) {
  const before = readFileSync(filePath, 'utf8');
  const replacements = collectSqliteSpecifierReplacements(before, filePath);
  const after = applyReplacements(before, replacements);

  if (after !== before) {
    writeFileSync(filePath, after, 'utf8');
    changedFiles += 1;
  }

  const remainingBare = collectBareSqliteSpecifiers(after, filePath);
  if (remainingBare.length > 0) {
    unresolved.push({ filePath, count: remainingBare.length });
  }
}

if (unresolved.length > 0) {
  for (const entry of unresolved) {
    console.error(`[build] unresolved bare sqlite specifier (${entry.count}): ${entry.filePath}`);
  }
  process.exit(1);
}

const summary = changedFiles === 0 ? 'no changes needed' : `rewrote ${changedFiles} file(s)`;
console.log(`[build] normalize sqlite imports: ${summary}`);
