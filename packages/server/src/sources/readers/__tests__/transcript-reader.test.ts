import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { encodeCursor } from '../transcript-cursor.js';
import { readTranscript } from '../transcript-reader.js';

function makeTmpFile(lines: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'transcript-test-'));
  const file = join(dir, 'test.jsonl');
  writeFileSync(file, lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n'));
  return file;
}

// Helper to create a message line in the real JSONL format (content nested in `message` envelope)
function msgLine(role: string, content: unknown, extra: Record<string, unknown> = {}, outerTs?: string): object {
  const inner: Record<string, unknown> = { role, content, ...extra };
  return { type: 'message', timestamp: outerTs ?? '2025-01-01T00:00:02Z', message: inner };
}

const SESSION_LINE = {
  type: 'session',
  id: 'abc-123',
  timestamp: '2025-01-01T00:00:00Z',
  cwd: '/tmp',
  version: '1.0',
};
const MODEL_CHANGE = {
  type: 'model_change',
  provider: 'anthropic',
  modelId: 'claude-opus-4-6',
  timestamp: '2025-01-01T00:00:01Z',
};
const THINKING_CHANGE = {
  type: 'thinking_level_change',
  thinkingLevel: 'high',
  timestamp: '2025-01-01T00:00:01Z',
};

describe('readTranscript', () => {
  it('parses normal messages', async () => {
    const file = makeTmpFile([
      SESSION_LINE,
      MODEL_CHANGE,
      THINKING_CHANGE,
      msgLine('user', 'hello', {}, '2025-01-01T00:00:02Z'),
      msgLine(
        'assistant',
        [{ type: 'text', text: 'hi there' }],
        {
          model: 'claude-opus-4-6',
          usage: { input: 10, output: 20, cacheRead: 5, cacheWrite: 2 },
        },
        '2025-01-01T00:00:03Z',
      ),
    ]);
    const result = await readTranscript(file, 'agent:main:test-session');
    expect(result.sessionKey).toBe('agent:main:test-session');
    expect(result.displayName).toBe('test-session');
    expect(result.model).toBe('claude-opus-4-6');
    expect(result.thinkingLevel).toBe('high');
    expect(result.startedAt).toBe('2025-01-01T00:00:00Z');
    expect(result.kind).toBe('direct');
    expect(result.isSubAgent).toBe(false);
    expect(result.totalMessages).toBe(2);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ role: 'user', content: 'hello', contentTruncated: false, seq: 0 });
    expect(result.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'hi there',
      model: 'claude-opus-4-6',
      seq: 1,
    });
    expect(result.messages[1].usage).toEqual({ input: 10, output: 20, cacheRead: 5, cacheWrite: 2 });
  });

  it('handles array content with multiple text blocks', async () => {
    const file = makeTmpFile([
      SESSION_LINE,
      msgLine('user', [
        { type: 'text', text: 'line1' },
        { type: 'image', url: 'x' },
        { type: 'text', text: 'line2' },
      ]),
    ]);
    const result = await readTranscript(file, 'agent:main:test');
    expect(result.messages[0].content).toBe('line1\nline2');
  });

  it('parses tool messages', async () => {
    const file = makeTmpFile([
      SESSION_LINE,
      msgLine('toolResult', 'file data', { toolName: 'Read' }),
      msgLine('toolResult', 'no name', {}),
    ]);
    const result = await readTranscript(file, 'agent:main:test');
    expect(result.messages[0]).toMatchObject({ role: 'tool', toolName: 'Read' });
    expect(result.messages[1]).toMatchObject({ role: 'tool', toolName: 'tool' });
  });

  it('paginates with before cursor and limit', async () => {
    const lines: unknown[] = [SESSION_LINE];
    for (let i = 0; i < 10; i++) {
      lines.push(msgLine('user', `msg${i}`, {}, `2025-01-01T00:00:${String(i).padStart(2, '0')}Z`));
    }
    const file = makeTmpFile(lines);
    const before = encodeCursor('2025-01-01T00:00:07Z', 7);
    const result = await readTranscript(file, 'agent:main:test', { before, limit: 4 });
    expect(result.totalMessages).toBe(10);
    expect(result.messages).toHaveLength(4);
    expect(result.messages[0].content).toBe('msg3');
    expect(result.messages[3].content).toBe('msg6');
    expect(result.pageInfo.hasPreviousPage).toBe(true);
    expect(result.pageInfo.hasNextPage).toBe(true);
  });

  it('returns tail-first page by default when no cursor is provided', async () => {
    const lines: unknown[] = [SESSION_LINE];
    for (let i = 0; i < 10; i++) {
      lines.push(msgLine('user', `msg${i}`, {}, `2025-01-01T00:00:${String(i).padStart(2, '0')}Z`));
    }
    const file = makeTmpFile(lines);
    const result = await readTranscript(file, 'agent:main:test', { limit: 3 });
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].content).toBe('msg7');
    expect(result.messages[2].content).toBe('msg9');
    expect(result.pageInfo.hasPreviousPage).toBe(true);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  it('truncates user/assistant content at 4000 chars', async () => {
    const longContent = 'x'.repeat(5000);
    const file = makeTmpFile([SESSION_LINE, msgLine('user', longContent)]);
    const result = await readTranscript(file, 'agent:main:test');
    expect(result.messages[0].content).toHaveLength(4000);
    expect(result.messages[0].contentTruncated).toBe(true);
  });

  it('truncates tool content at 1000 chars', async () => {
    const longContent = 'y'.repeat(2000);
    const file = makeTmpFile([SESSION_LINE, msgLine('toolResult', longContent, { toolName: 'Read' })]);
    const result = await readTranscript(file, 'agent:main:test');
    expect(result.messages[0].content).toHaveLength(1000);
    expect(result.messages[0].contentTruncated).toBe(true);
  });

  it('rejects files over 10MB', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'transcript-test-'));
    const file = join(dir, 'big.jsonl');
    writeFileSync(file, Buffer.alloc(50 * 1024 * 1024 + 1));
    await expect(readTranscript(file, 'agent:main:test')).rejects.toThrow('File too large');
  });

  it('skips malformed JSON lines', async () => {
    const file = makeTmpFile([SESSION_LINE, 'not valid json {{{', msgLine('user', 'ok')]);
    const result = await readTranscript(file, 'agent:main:test');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe('ok');
  });

  it('handles empty file', async () => {
    const file = makeTmpFile([]);
    const result = await readTranscript(file, 'agent:main:test');
    expect(result.totalMessages).toBe(0);
    expect(result.messages).toHaveLength(0);
    expect(result.model).toBe('unknown');
  });

  it('detects sub-agent and extracts spawn prompt', async () => {
    const file = makeTmpFile([
      SESSION_LINE,
      msgLine('user', 'do the thing'),
      msgLine('assistant', [{ type: 'text', text: 'done' }], { model: 'claude-opus-4-6' }),
    ]);
    const result = await readTranscript(file, 'agent:main:subagent:abc12345-1234-5678-9abc-def012345678');
    expect(result.isSubAgent).toBe(true);
    expect(result.spawnPrompt).toBe('do the thing');
    expect(result.displayName).toBe('subagent:abc12345');
    expect(result.parentDisplayName).not.toBeNull();
  });

  it('detects cron kind from session key', async () => {
    const file = makeTmpFile([SESSION_LINE]);
    const result = await readTranscript(file, 'agent:main:cron:daily-check');
    expect(result.kind).toBe('cron');
  });

  it('gets model from assistant message when no model_change', async () => {
    const file = makeTmpFile([
      SESSION_LINE,
      msgLine('assistant', [{ type: 'text', text: 'hi' }], { model: 'claude-sonnet-4-20250514' }),
    ]);
    const result = await readTranscript(file, 'agent:main:test');
    expect(result.model).toBe('claude-sonnet-4-20250514');
  });

  it('uses inner message timestamp (epoch ms) when available', async () => {
    const file = makeTmpFile([
      SESSION_LINE,
      {
        type: 'message',
        timestamp: '2025-01-01T00:00:02Z',
        message: { role: 'user', content: 'hi', timestamp: 1735689602000 },
      },
    ]);
    const result = await readTranscript(file, 'agent:main:test');
    // inner epoch 1735689602000 = 2025-01-01T00:00:02.000Z
    expect(result.messages[0].timestamp).toBe('2025-01-01T00:00:02.000Z');
  });
});
