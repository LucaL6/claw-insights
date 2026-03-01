import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ScanStateRow } from '../../../db/scan-state-queries.js';
import { classifyFiles } from '../file-classifier.js';

function makeScanRow(overrides: Partial<ScanStateRow> & { filePath: string }): ScanStateRow {
  return {
    byteOffset: 0,
    inode: 1,
    mtimeMs: 1000,
    birthMs: 500,
    partial: '',
    firstTimestampMs: null,
    ...overrides,
  };
}

describe('classifyFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fc-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty result for empty directory', () => {
    const result = classifyFiles(tmpDir, new Map());
    expect(result.unchanged.size).toBe(0);
    expect(result.toScan).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('returns empty result for non-existent directory', () => {
    const result = classifyFiles(join(tmpDir, 'nope'), new Map());
    expect(result.unchanged.size).toBe(0);
    expect(result.toScan).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('classifies unchanged files', () => {
    const file = join(tmpDir, 'a.jsonl');
    writeFileSync(file, 'hello');
    const st = statSync(file);

    const cached = new Map<string, ScanStateRow>();
    cached.set(
      file,
      makeScanRow({
        filePath: file,
        byteOffset: st.size,
        inode: st.ino,
        mtimeMs: st.mtimeMs,
        birthMs: st.birthtimeMs,
        partial: 'part',
      }),
    );

    const result = classifyFiles(tmpDir, cached);
    expect(result.unchanged.size).toBe(1);
    expect(result.unchanged.get(file)).toEqual({
      offset: st.size,
      inode: st.ino,
      birthtimeMs: st.birthtimeMs,
      partialLine: 'part',
    });
    expect(result.toScan).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('classifies appended files with prevFirstTimestampMs carried forward', () => {
    const file = join(tmpDir, 'b.jsonl');
    writeFileSync(file, 'hello world');
    const st = statSync(file);

    const cached = new Map<string, ScanStateRow>();
    cached.set(
      file,
      makeScanRow({
        filePath: file,
        byteOffset: 5, // less than current size
        inode: st.ino,
        mtimeMs: st.mtimeMs - 1, // different mtime
        partial: 'hel',
        firstTimestampMs: 42000,
      }),
    );

    const result = classifyFiles(tmpDir, cached);
    expect(result.toScan).toEqual([{ path: file, offset: 5, partial: 'hel', prevFirstTimestampMs: 42000 }]);
    expect(result.unchanged.size).toBe(0);
  });

  it('classifies new files (not in cache)', () => {
    const file = join(tmpDir, 'c.jsonl');
    writeFileSync(file, 'data');

    const result = classifyFiles(tmpDir, new Map());
    expect(result.toScan).toEqual([{ path: file, offset: 0, partial: '', prevFirstTimestampMs: null }]);
  });

  it('classifies deleted files (in cache but not on disk)', () => {
    const missingFile = join(tmpDir, 'gone.jsonl');
    const cached = new Map<string, ScanStateRow>();
    cached.set(missingFile, makeScanRow({ filePath: missingFile }));

    const result = classifyFiles(tmpDir, cached);
    expect(result.deleted).toEqual([missingFile]);
  });

  it('classifies replaced files (different inode) as full scan', () => {
    const file = join(tmpDir, 'd.jsonl');
    writeFileSync(file, 'new content');
    const st = statSync(file);

    const cached = new Map<string, ScanStateRow>();
    cached.set(
      file,
      makeScanRow({
        filePath: file,
        byteOffset: 100,
        inode: st.ino + 999, // different inode
        firstTimestampMs: 12345,
      }),
    );

    const result = classifyFiles(tmpDir, cached);
    expect(result.toScan).toEqual([{ path: file, offset: 0, partial: '', prevFirstTimestampMs: null }]);
  });

  it('skips files with stat errors without aborting', async () => {
    const good = join(tmpDir, 'good.jsonl');
    writeFileSync(good, 'ok');

    // Create a symlink to nowhere to trigger stat error
    const bad = join(tmpDir, 'bad.jsonl');
    const { symlinkSync } = await import('node:fs');
    symlinkSync(join(tmpDir, 'nonexistent'), bad);

    const result = classifyFiles(tmpDir, new Map());
    expect(result.toScan).toHaveLength(1);
    expect(result.toScan[0]!.path).toBe(good);
  });

  it('only considers .jsonl files', () => {
    writeFileSync(join(tmpDir, 'a.jsonl'), 'data');
    writeFileSync(join(tmpDir, 'b.txt'), 'data');
    writeFileSync(join(tmpDir, 'c.json'), 'data');

    const result = classifyFiles(tmpDir, new Map());
    expect(result.toScan).toHaveLength(1);
    expect(result.toScan[0]!.path).toContain('a.jsonl');
  });
});
