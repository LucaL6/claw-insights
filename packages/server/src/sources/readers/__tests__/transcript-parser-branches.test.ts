import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { parseTranscript } from '../transcript-parser.js';

function makeTmpFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'parser-branch-'));
  const file = join(dir, 'test.jsonl');
  writeFileSync(file, content);
  return file;
}

function makeTmpJsonl(lines: (object | string)[]): string {
  return makeTmpFile(lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n'));
}

const ts = '2025-01-01T00:00:00Z';

describe('transcript-parser branch coverage', () => {
  it('skips malformed JSON lines and parses valid ones', async () => {
    const file = makeTmpJsonl([
      'NOT VALID JSON {{{',
      { type: 'message', timestamp: ts, message: { role: 'user', content: 'hello' } },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe('hello');
  });

  it('empty file → empty result with defaults', async () => {
    const file = makeTmpFile('');
    const result = await parseTranscript(file, 'key');
    expect(result.messages).toHaveLength(0);
    expect(result.meta.model).toBe('unknown');
    expect(result.meta.channel).toBeNull();
    expect(result.meta.thinkingLevel).toBeNull();
    expect(result.meta.firstUserContent).toBeNull();
    expect(result.meta.durationMs).toBe(0);
  });

  it('skips whitespace-only lines', async () => {
    const file = makeTmpJsonl(['   ', { type: 'message', timestamp: ts, message: { role: 'user', content: 'ok' } }]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages).toHaveLength(1);
  });

  it('valid line after multiple invalid lines', async () => {
    const file = makeTmpJsonl([
      'bad1',
      'bad2',
      '{also bad',
      { type: 'message', timestamp: ts, message: { role: 'user', content: 'finally' } },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe('finally');
  });

  it('filters out unknown roles', async () => {
    const file = makeTmpJsonl([
      { type: 'message', timestamp: ts, message: { role: 'system', content: 'sys' } },
      { type: 'message', timestamp: ts, message: { role: 'user', content: 'hi' } },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
  });

  it('truncated file (no trailing newline) parses available', async () => {
    const file = makeTmpFile(
      JSON.stringify({ type: 'message', timestamp: ts, message: { role: 'user', content: 'truncated' } }),
    );
    const result = await parseTranscript(file, 'key');
    expect(result.messages).toHaveLength(1);
  });

  it('content as array of blocks', async () => {
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: ts,
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }],
        },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].content).toBe('a\nb');
  });

  it('content as non-string non-array → empty', async () => {
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: ts,
        message: { role: 'user', content: 12345 },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].content).toBe('');
  });

  it('truncates long user content', async () => {
    const longContent = 'x'.repeat(5000);
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: ts,
        message: { role: 'user', content: longContent },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].contentTruncated).toBe(true);
    expect(result.messages[0].content.length).toBe(4000);
  });

  it('truncates long tool content at 1000', async () => {
    const longContent = 'y'.repeat(2000);
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: ts,
        message: { role: 'toolResult', content: longContent, name: 'read' },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].contentTruncated).toBe(true);
    expect(result.messages[0].content.length).toBe(1000);
    expect(result.messages[0].toolName).toBe('read');
  });

  it('thinking_level_change: only first is kept', async () => {
    const file = makeTmpJsonl([
      { type: 'thinking_level_change', thinkingLevel: 'high' },
      { type: 'thinking_level_change', thinkingLevel: 'low' },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.meta.thinkingLevel).toBe('high');
  });

  it('thinking_level_change without thinkingLevel field → stays null', async () => {
    const file = makeTmpJsonl([{ type: 'thinking_level_change' }]);
    const result = await parseTranscript(file, 'key');
    expect(result.meta.thinkingLevel).toBeNull();
  });

  it('model_change without modelId → model stays empty', async () => {
    const file = makeTmpJsonl([{ type: 'model_change' }]);
    const result = await parseTranscript(file, 'key');
    expect(result.meta.model).toBe('unknown');
  });

  it('session line without optional fields', async () => {
    const file = makeTmpJsonl([{ type: 'session' }]);
    const result = await parseTranscript(file, 'key');
    expect(result.meta.channel).toBeNull();
    expect(result.meta.kind).toBe('direct');
  });

  it('session with group sets kind', async () => {
    const file = makeTmpJsonl([{ type: 'session', timestamp: ts, group: 'discord' }]);
    const result = await parseTranscript(file, 'key');
    expect(result.meta.kind).toBe('discord');
  });

  it('sessionKey with :cron: overrides kind', async () => {
    const file = makeTmpJsonl([{ type: 'session', timestamp: ts, group: 'discord' }]);
    const result = await parseTranscript(file, 'agent:main:cron:daily');
    expect(result.meta.kind).toBe('cron');
  });

  it('message type without message field → skipped', async () => {
    const file = makeTmpJsonl([
      { type: 'message', timestamp: ts },
      { type: 'message', timestamp: ts, message: { role: 'user', content: 'ok' } },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages).toHaveLength(1);
  });

  it('unknown type lines → skipped', async () => {
    const file = makeTmpJsonl([
      { type: 'heartbeat', timestamp: ts },
      { type: 'message', timestamp: ts, message: { role: 'user', content: 'ok' } },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages).toHaveLength(1);
  });

  it('assistant usage with alternative field names', async () => {
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: ts,
        message: {
          role: 'assistant',
          content: 'hi',
          model: 'claude-4',
          usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 },
        },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].usage).toEqual({ input: 100, output: 50, cacheRead: 10, cacheWrite: 5 });
    expect(result.meta.totalTokens).toBe(160);
    expect(result.meta.contextTokens).toBe(110);
  });

  it('assistant usage with cacheReadInputTokens/cacheCreationInputTokens', async () => {
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: ts,
        message: {
          role: 'assistant',
          content: 'hi',
          model: 'claude-4',
          usage: { input: 50, output: 20, cacheReadInputTokens: 30, cacheCreationInputTokens: 15 },
        },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].usage).toEqual({ input: 50, output: 20, cacheRead: 30, cacheWrite: 15 });
  });

  it('message.timestamp (numeric) used over outer timestamp', async () => {
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: '2025-06-01T00:00:00Z',
        message: { role: 'user', content: 'hi', timestamp: 1735689600000 },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].timestamp).toBe(new Date(1735689600000).toISOString());
  });

  it('toolResult with name fallback (no toolName)', async () => {
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: ts,
        message: { role: 'toolResult', content: 'res', name: 'bash' },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].toolName).toBe('bash');
  });

  it('toolResult with no toolName or name → defaults to "tool"', async () => {
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: ts,
        message: { role: 'toolResult', content: 'res' },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].toolName).toBe('tool');
  });

  it('startedAt from first message when no session line', async () => {
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: '2025-03-01T12:00:00Z',
        message: { role: 'user', content: 'hi' },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.meta.startedAt).toBe('2025-03-01T12:00:00Z');
  });

  it('durationMs computed from startedAt to last message', async () => {
    const file = makeTmpJsonl([
      { type: 'session', timestamp: '2025-01-01T00:00:00Z' },
      { type: 'message', timestamp: '2025-01-01T00:05:00Z', message: { role: 'user', content: 'hi' } },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.meta.durationMs).toBe(300000);
  });

  it('text block without text field → empty string', async () => {
    const file = makeTmpJsonl([
      {
        type: 'message',
        timestamp: ts,
        message: { role: 'user', content: [{ type: 'text' }] },
      },
    ]);
    const result = await parseTranscript(file, 'key');
    expect(result.messages[0].content).toBe('');
  });
});
