import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ScanStateRow } from '../../../db/scan-state-queries.js';
import type { FileToScan } from '../file-classifier.js';
import type { ParsedMessageEvent, ParsedTokenEvent } from '../transcript-parser.js';
import type { ScanSink } from '../transcript-scanner.js';
import { scanFiles } from '../transcript-scanner.js';

function makeLine(role: string, model?: string, ts = '2025-01-15T10:00:00Z'): string {
  const msg: Record<string, unknown> = { role };
  if (role === 'assistant' && model) {
    msg.model = model;
    msg.usage = { input_tokens: 10, output_tokens: 5 };
  }
  return JSON.stringify({ type: 'message', timestamp: ts, message: msg });
}

function createSink() {
  const tokens: ParsedTokenEvent[] = [];
  const messages: ParsedMessageEvent[] = [];
  const completions: ScanStateRow[] = [];
  const sink: ScanSink = {
    onToken: (t) => tokens.push(t),
    onMessage: (m) => messages.push(m),
    onFileComplete: (s) => completions.push(s),
  };
  return { sink, tokens, messages, completions };
}

function makeTempFiles(count: number, lines: string[] = [makeLine('user'), makeLine('assistant', 'gpt-4')]): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'scan-test-'));
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    const p = join(dir, `file-${i}.jsonl`);
    writeFileSync(p, lines.join('\n') + '\n');
    paths.push(p);
  }
  return paths;
}

describe('scanFiles', () => {
  it('scans files on main thread and delivers events to sink', async () => {
    const paths = makeTempFiles(3);
    const toScan: FileToScan[] = paths.map((p) => ({
      path: p,
      offset: 0,
      partial: '',
      prevFirstTimestampMs: null,
    }));

    const { sink, tokens, messages, completions } = createSink();
    await scanFiles(toScan, sink, { workerThreshold: 100 }); // force main thread

    // Each file has 1 user message + 1 assistant message (with token)
    expect(messages.length).toBe(6); // 3 files × 2 messages
    expect(tokens.length).toBe(3); // 3 files × 1 token event (assistant only)
    expect(completions.length).toBe(3);

    for (const c of completions) {
      expect(c.byteOffset).toBeGreaterThan(0);
      expect(c.firstTimestampMs).toBeGreaterThan(0);
    }
  });

  it('does nothing for empty toScan', async () => {
    const { sink, tokens, messages, completions } = createSink();
    await scanFiles([], sink);
    expect(tokens).toHaveLength(0);
    expect(messages).toHaveLength(0);
    expect(completions).toHaveLength(0);
  });

  it('calls onError for a bad file and continues', async () => {
    const goodPaths = makeTempFiles(2);
    const toScan: FileToScan[] = [
      { path: goodPaths[0], offset: 0, partial: '', prevFirstTimestampMs: null },
      { path: '/nonexistent/bad-file.jsonl', offset: 0, partial: '', prevFirstTimestampMs: null },
      { path: goodPaths[1], offset: 0, partial: '', prevFirstTimestampMs: null },
    ];

    const errors: Array<{ file: string; err: Error }> = [];
    const { sink, completions } = createSink();
    await scanFiles(toScan, sink, {
      workerThreshold: 100,
      onError: (file, err) => errors.push({ file, err }),
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].file).toBe('/nonexistent/bad-file.jsonl');
    expect(completions).toHaveLength(2); // good files completed
  });

  it('falls back to main thread when worker fails', async () => {
    const paths = makeTempFiles(1);
    const toScan: FileToScan[] = [{ path: paths[0], offset: 0, partial: '', prevFirstTimestampMs: null }];

    const { sink, completions, tokens, messages } = createSink();
    // Force worker path with threshold=0; workers will fail in test env and fall back
    await scanFiles(toScan, sink, { workerThreshold: 0, fallbackToMainThread: true });

    expect(completions).toHaveLength(1);
    expect(messages.length).toBeGreaterThan(0);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('preserves prevFirstTimestampMs for incremental scans', async () => {
    const paths = makeTempFiles(1);
    const toScan: FileToScan[] = [
      {
        path: paths[0],
        offset: 50, // nonzero = incremental
        partial: '',
        prevFirstTimestampMs: 1700000000000,
      },
    ];

    const { sink, completions } = createSink();
    await scanFiles(toScan, sink, { workerThreshold: 100 });

    expect(completions).toHaveLength(1);
    // streamScanFile returns null for firstTimestampMs when offset > 0,
    // so it should fall back to prevFirstTimestampMs
    expect(completions[0].firstTimestampMs).toBe(1700000000000);
  });
});
