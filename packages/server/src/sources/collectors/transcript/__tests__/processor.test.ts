import { mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { processFile, readFileChunk } from '../processing/processor.js';
import type { FileTask } from '../types.js';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'transcript-processor-'));
}

function line(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

const userMsg = (ts: string) => line({ type: 'message', timestamp: ts, message: { role: 'user' } });

const assistantMsg = (ts: string, model = 'claude', input = 10, output = 20) =>
  line({
    type: 'message',
    timestamp: ts,
    message: { role: 'assistant', model, usage: { input_tokens: input, output_tokens: output } },
  });

function task(path: string, overrides: Partial<FileTask> = {}): FileTask {
  return {
    path,
    offset: 0,
    partial: '',
    sessionKey: 'session-1',
    prevFirstTimestampMs: null,
    ...overrides,
  };
}

describe('transcript-processor', () => {
  let dir: string;

  beforeEach(() => {
    dir = tempDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('normal parse from offset 0', async () => {
    const file = join(dir, 'session-1.jsonl');
    writeFileSync(file, `${userMsg('2026-01-01T00:00:00Z')}\n${assistantMsg('2026-01-01T00:00:01Z')}\n`);

    const result = await processFile(task(file));

    expect(result.messages).toHaveLength(2);
    expect(result.tokens).toHaveLength(1);
    expect(result.newState.offset).toBeGreaterThan(0);
    expect(result.newState.partial).toBe('');
  });

  it('partial line no trailing newline parses EOF line and keeps partial (stream compatibility)', async () => {
    const file = join(dir, 'session-1.jsonl');
    writeFileSync(file, `${userMsg('2026-01-01T00:00:00Z')}\n${assistantMsg('2026-01-01T00:00:01Z')}`);

    const result = await processFile(task(file));

    expect(result.messages).toHaveLength(2);
    expect(result.tokens).toHaveLength(1);
    expect(result.newState.partial.length).toBeGreaterThan(0);
  });

  it('maxBytes budget', async () => {
    const file = join(dir, 'session-1.jsonl');
    const content = `${userMsg('2026-01-01T00:00:00Z')}\n${assistantMsg('2026-01-01T00:00:01Z')}\n`;
    writeFileSync(file, content);

    const chunk = await readFileChunk(file, 0, '', { maxBytes: 10 });
    expect(chunk.bytesRead).toBeLessThanOrEqual(10);
    expect(chunk.newOffset).toBe(10);

    const result = await processFile(task(file), { maxBytes: 10 });
    expect(result.newState.offset).toBe(10);
  });

  it('inode change truncate reset', async () => {
    const file = join(dir, 'session-1.jsonl');
    writeFileSync(file, `${userMsg('2026-01-01T00:00:00Z')}\n`);
    const initial = statSync(file);

    const moved = join(dir, 'old.jsonl');
    renameSync(file, moved);
    writeFileSync(file, `${userMsg('2026-01-01T00:01:00Z')}\n`);

    const result = await processFile(task(file, { offset: 999, inode: initial.ino, birthtimeMs: initial.birthtimeMs }));
    expect(result.messages).toHaveLength(1);
    expect(result.newState.offset).toBe(statSync(file).size);
  });

  it('offset > size truncate reset', async () => {
    const file = join(dir, 'session-1.jsonl');
    writeFileSync(file, `${userMsg('2026-01-01T00:00:00Z')}\n`);

    const result = await processFile(task(file, { offset: 1000 }));
    expect(result.messages).toHaveLength(1);
    expect(result.newState.offset).toBe(statSync(file).size);
  });

  it('non-existent file throws', async () => {
    await expect(processFile(task(join(dir, 'missing.jsonl')))).rejects.toThrow();
  });

  it('empty file', async () => {
    const file = join(dir, 'session-1.jsonl');
    writeFileSync(file, '');

    const result = await processFile(task(file));
    expect(result.messages).toEqual([]);
    expect(result.tokens).toEqual([]);
    expect(result.newState.offset).toBe(0);
    expect(result.newState.partial).toBe('');
  });

  it('UTF-8 multibyte boundary', async () => {
    const file = join(dir, 'session-1.jsonl');
    const emojiLine = line({ type: 'message', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: '你好😀' } });
    writeFileSync(file, `${emojiLine}\n`);

    const first = await processFile(task(file), { maxBytes: Buffer.byteLength(emojiLine, 'utf-8') - 1 });
    expect(first.messages).toHaveLength(0);
    expect(first.newState.partial.length).toBeGreaterThan(0);

    const second = await processFile(task(file, {
      offset: first.newState.offset,
      partial: first.newState.partial,
      prevFirstTimestampMs: first.newState.firstTimestampMs,
      inode: first.newState.inode,
      birthtimeMs: first.newState.birthtimeMs,
    }));
    expect(second.messages).toHaveLength(1);
  });

  it('firstTimestampMs extraction', async () => {
    const file = join(dir, 'session-1.jsonl');
    const ts = '2026-03-01T12:34:56Z';
    writeFileSync(file, `${userMsg(ts)}\n${assistantMsg('2026-03-01T12:35:00Z')}\n`);

    const result = await processFile(task(file));
    expect(result.firstTimestampMs).toBe(new Date(ts).getTime());
    expect(result.newState.firstTimestampMs).toBe(new Date(ts).getTime());
  });
});
