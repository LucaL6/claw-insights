import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { parseTranscript } from '../transcript-parser.js';

function makeTmpFile(lines: object[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'parser-test-'));
  const file = join(dir, 'test.jsonl');
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n'));
  return file;
}

const SESSION_LINE = { type: 'session', timestamp: '2025-01-01T00:00:00Z', channel: 'telegram' };
const MODEL_CHANGE = { type: 'model_change', modelId: 'claude-3' };

function msgLine(role: string, content: string, extra: Record<string, unknown> = {}, outerTs?: string) {
  return {
    type: 'message',
    timestamp: outerTs ?? '2025-01-01T00:00:02Z',
    message: { role, content, ...extra },
  };
}

describe('parseTranscript', () => {
  it('parses messages with sequential seq', async () => {
    const file = makeTmpFile([SESSION_LINE, MODEL_CHANGE, msgLine('user', 'hello'), msgLine('assistant', 'hi')]);
    const result = await parseTranscript(file, 'test-key');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].seq).toBe(0);
    expect(result.messages[1].seq).toBe(1);
    expect(result.meta.model).toBe('claude-3');
    expect(result.meta.channel).toBe('telegram');
  });

  it('assigns epoch zero for first message with no timestamp', async () => {
    const file = makeTmpFile([{ type: 'message', message: { role: 'user', content: 'no-ts' } }]);
    const result = await parseTranscript(file, 'test-key');
    expect(result.messages[0].timestamp).toBe('1970-01-01T00:00:00.000Z');
    expect(result.messages[0].seq).toBe(0);
  });

  it('uses previous message timestamp as fallback', async () => {
    const file = makeTmpFile([
      msgLine('user', 'first'),
      { type: 'message', message: { role: 'assistant', content: 'no-ts' } },
    ]);
    const result = await parseTranscript(file, 'test-key');
    expect(result.messages[1].timestamp).toBe(result.messages[0].timestamp);
  });

  it('handles toolResult as tool role', async () => {
    const file = makeTmpFile([msgLine('toolResult', 'result', { toolName: 'exec' })]);
    const result = await parseTranscript(file, 'test-key');
    expect(result.messages[0].role).toBe('tool');
    expect(result.messages[0].toolName).toBe('exec');
  });
});
