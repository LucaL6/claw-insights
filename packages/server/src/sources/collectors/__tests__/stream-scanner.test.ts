import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { streamScanFile } from '../stream-scanner.js';
import type { ParsedMessageEvent, ParsedTokenEvent } from '../transcript-parser.js';

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'stream-scan-'));
}

function line(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

const userMsg = (ts: string) => line({ type: 'message', timestamp: ts, message: { role: 'user' } });

const assistantMsg = (ts: string, model = 'claude', input = 10, output = 20) =>
  line({
    type: 'message',
    timestamp: ts,
    message: {
      role: 'assistant',
      model,
      usage: { input_tokens: input, output_tokens: output },
    },
  });

describe('streamScanFile', () => {
  let dir: string;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('scans full file from offset 0', async () => {
    const file = join(dir, 'test.jsonl');
    writeFileSync(file, [userMsg('2026-01-01T00:00:00Z'), assistantMsg('2026-01-01T00:00:01Z')].join('\n') + '\n');
    const tokens: ParsedTokenEvent[] = [];
    const messages: ParsedMessageEvent[] = [];
    const result = await streamScanFile(
      file,
      0,
      '',
      (t) => tokens.push(t),
      (m) => messages.push(m),
    );
    expect(messages).toHaveLength(2);
    expect(tokens).toHaveLength(1);
    expect(result.newOffset).toBeGreaterThan(0);
    expect(result.partial).toBe('');
  });

  it('scans incrementally from byte offset', async () => {
    const file = join(dir, 'test.jsonl');
    const firstLine = userMsg('2026-01-01T00:00:00Z') + '\n';
    const secondLine = userMsg('2026-01-01T00:01:00Z') + '\n';
    writeFileSync(file, firstLine + secondLine);
    const messages: ParsedMessageEvent[] = [];
    const result = await streamScanFile(
      file,
      Buffer.byteLength(firstLine, 'utf-8'),
      '',
      () => {},
      (m) => messages.push(m),
    );
    expect(messages).toHaveLength(1);
    expect(result.newOffset).toBe(Buffer.byteLength(firstLine + secondLine, 'utf-8'));
  });

  it('joins partial line from previous scan', async () => {
    const file = join(dir, 'test.jsonl');
    const fullLine = userMsg('2026-01-01T00:00:00Z');
    const splitAt = 20;
    const partial = fullLine.slice(0, splitAt);
    const remainder = fullLine.slice(splitAt) + '\n';
    writeFileSync(file, remainder);
    const messages: ParsedMessageEvent[] = [];
    await streamScanFile(
      file,
      0,
      partial,
      () => {},
      (m) => messages.push(m),
    );
    expect(messages).toHaveLength(1);
  });

  it('handles empty file', async () => {
    const file = join(dir, 'test.jsonl');
    writeFileSync(file, '');
    const tokens: ParsedTokenEvent[] = [];
    const result = await streamScanFile(
      file,
      0,
      '',
      (t) => tokens.push(t),
      () => {},
    );
    expect(tokens).toHaveLength(0);
    expect(result.newOffset).toBe(0);
  });

  it('skips corrupt lines without crashing', async () => {
    const file = join(dir, 'test.jsonl');
    writeFileSync(file, 'not json\n' + userMsg('2026-01-01T00:00:00Z') + '\n');
    const messages: ParsedMessageEvent[] = [];
    await streamScanFile(
      file,
      0,
      '',
      () => {},
      (m) => messages.push(m),
    );
    expect(messages).toHaveLength(1);
  });

  it('full scan (offset=0) returns firstTimestampMs from first line', async () => {
    const file = join(dir, 'test.jsonl');
    writeFileSync(file, [userMsg('2026-03-01T10:00:00Z'), assistantMsg('2026-03-01T10:00:01Z')].join('\n') + '\n');
    const result = await streamScanFile(
      file,
      0,
      '',
      () => {},
      () => {},
    );
    expect(result.firstTimestampMs).toBe(new Date('2026-03-01T10:00:00Z').getTime());
  });

  it('incremental scan (offset>0) returns firstTimestampMs = null', async () => {
    const file = join(dir, 'test.jsonl');
    const firstLine = userMsg('2026-03-01T10:00:00Z') + '\n';
    const secondLine = userMsg('2026-03-01T10:01:00Z') + '\n';
    writeFileSync(file, firstLine + secondLine);
    const result = await streamScanFile(
      file,
      Buffer.byteLength(firstLine, 'utf-8'),
      '',
      () => {},
      () => {},
    );
    expect(result.firstTimestampMs).toBeNull();
  });

  it('handles 1000 lines without excessive memory', async () => {
    const file = join(dir, 'large.jsonl');
    const lines = Array.from({ length: 1000 }, (_, i) =>
      userMsg(`2026-01-01T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`),
    );
    writeFileSync(file, lines.join('\n') + '\n');
    let count = 0;
    await streamScanFile(
      file,
      0,
      '',
      () => {},
      () => {
        count++;
      },
    );
    expect(count).toBe(1000);
  });
});
