import { mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ScanStateRow } from '../../../../db/scan-state-queries.js';
import { classifyFiles } from '../processing/file-classifier.js';

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
      partial: 'part',
    });
    expect(result.toScan).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.deferred).toEqual([]);
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

  it('defers files with mtime below cutoff', () => {
    const old = join(tmpDir, 'old.jsonl');
    const recent = join(tmpDir, 'recent.jsonl');
    writeFileSync(old, 'old-data');
    const threeDaysAgo = Date.now() - 3 * 86_400_000;
    utimesSync(old, threeDaysAgo / 1000, threeDaysAgo / 1000);
    writeFileSync(recent, 'new-data');

    const cutoff = Date.now() - 48 * 3_600_000;
    const result = classifyFiles(tmpDir, new Map(), cutoff);

    expect(result.toScan).toHaveLength(1);
    expect(result.toScan[0]!.path).toContain('recent.jsonl');
    expect(result.deferred).toHaveLength(1);
    expect(result.deferred[0]!.path).toContain('old.jsonl');
  });

  it('returns empty deferred when no mtimeCutoff provided', () => {
    const file = join(tmpDir, 'a.jsonl');
    writeFileSync(file, 'data');

    const result = classifyFiles(tmpDir, new Map());
    expect(result.deferred).toEqual([]);
    expect(result.toScan).toHaveLength(1);
  });

  it('defers unchanged files below cutoff with cached state preserved', () => {
    const file = join(tmpDir, 'old.jsonl');
    writeFileSync(file, 'hello');

    const threeDaysAgo = Date.now() - 3 * 86_400_000;
    utimesSync(file, threeDaysAgo / 1000, threeDaysAgo / 1000);
    const stOld = statSync(file);

    const cached = new Map<string, ScanStateRow>();
    cached.set(
      file,
      makeScanRow({
        filePath: file,
        byteOffset: stOld.size,
        inode: stOld.ino,
        mtimeMs: stOld.mtimeMs,
        birthMs: stOld.birthtimeMs,
        partial: 'part',
      }),
    );

    const cutoff = Date.now() - 48 * 3_600_000;
    const result = classifyFiles(tmpDir, cached, cutoff);

    expect(result.unchanged.size).toBe(0);
    expect(result.toScan).toHaveLength(0);
    expect(result.deferred).toHaveLength(1);
    expect(result.deferred[0]!.path).toBe(file);
    expect(result.deferred[0]!.offset).toBe(stOld.size);
    expect(result.deferred[0]!.partial).toBe('part');
  });
});
