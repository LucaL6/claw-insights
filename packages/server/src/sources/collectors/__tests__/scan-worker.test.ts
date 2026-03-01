import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run } from '../scan-worker.js';

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'scan-worker-'));
}

function line(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

const userMsg = (ts: string) => line({ type: 'message', timestamp: ts, message: { role: 'user' } });

const assistantMsg = (ts: string) =>
  line({
    type: 'message',
    timestamp: ts,
    message: { role: 'assistant', model: 'claude', usage: { input_tokens: 10, output_tokens: 20 } },
  });

describe('scan-worker', () => {
  let dir: string;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('scans multiple files and returns aggregated results', async () => {
    const file1 = join(dir, 'sess1.jsonl');
    const file2 = join(dir, 'sess2.jsonl');
    writeFileSync(file1, [userMsg('2026-01-01T00:00:00Z'), assistantMsg('2026-01-01T00:00:01Z')].join('\n') + '\n');
    writeFileSync(file2, [userMsg('2026-01-01T00:01:00Z')].join('\n') + '\n');

    const result = await run({
      files: [
        { path: file1, offset: 0, partial: '' },
        { path: file2, offset: 0, partial: '' },
      ],
    });
    expect(result.files).toHaveLength(2);
    expect(result.tokenEvents).toHaveLength(1);
    expect(result.messageEvents).toHaveLength(3);
  });

  it('handles incremental offset', async () => {
    const file = join(dir, 'sess1.jsonl');
    const firstLine = userMsg('2026-01-01T00:00:00Z') + '\n';
    const secondLine = userMsg('2026-01-01T00:01:00Z') + '\n';
    writeFileSync(file, firstLine + secondLine);

    const result = await run({
      files: [{ path: file, offset: Buffer.byteLength(firstLine, 'utf-8'), partial: '' }],
    });
    expect(result.messageEvents).toHaveLength(1);
  });

  it('handles empty file list', async () => {
    const result = await run({ files: [] });
    expect(result.files).toHaveLength(0);
    expect(result.tokenEvents).toHaveLength(0);
  });

  it('survives corrupt files without crashing', async () => {
    const file = join(dir, 'bad.jsonl');
    writeFileSync(file, 'not json\n{}\n' + userMsg('2026-01-01T00:00:00Z') + '\n');

    const result = await run({
      files: [{ path: file, offset: 0, partial: '' }],
    });
    expect(result.messageEvents).toHaveLength(1);
    expect(result.files[0].error).toBeUndefined();
  });
});
