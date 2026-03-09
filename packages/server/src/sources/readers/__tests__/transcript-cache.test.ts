import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TranscriptCache } from '../transcript-cache.js';

interface TranscriptMeta {
  model: string;
  channel: string | null;
  kind: string;
  thinkingLevel: string | null;
  startedAt: string;
  totalTokens: number;
  contextTokens: number;
  durationMs: number;
  firstUserContent: string | null;
}

interface ParsedMessage {
  timestamp: string;
  seq: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  contentTruncated: boolean;
  toolName?: string;
}

type ParseResult = { meta: TranscriptMeta; messages: ParsedMessage[] };

function makeMeta(model: string): TranscriptMeta {
  return {
    model,
    channel: null,
    kind: 'chat',
    thinkingLevel: null,
    startedAt: '2026-01-01T00:00:00Z',
    totalTokens: 0,
    contextTokens: 0,
    durationMs: 0,
    firstUserContent: null,
  };
}

const mockParser = vi.fn<(filePath: string, sessionKey: string) => Promise<ParseResult>>();

describe('TranscriptCache', () => {
  beforeEach(() => {
    mockParser.mockReset();
  });

  it('calls parser on first access', async () => {
    const cache = new TranscriptCache(mockParser, { max: 10 });
    const data: ParseResult = { meta: makeMeta('test'), messages: [] };
    mockParser.mockResolvedValueOnce(data);
    const result = await cache.get('/tmp/a.jsonl', 'key', { mtimeMs: 1000, size: 500 });
    expect(mockParser).toHaveBeenCalledOnce();
    expect(result.meta.model).toBe('test');
  });

  it('returns cached on same mtime+size', async () => {
    const cache = new TranscriptCache(mockParser, { max: 10 });
    const data: ParseResult = { meta: makeMeta('test'), messages: [] };
    mockParser.mockResolvedValueOnce(data);
    await cache.get('/tmp/a.jsonl', 'key', { mtimeMs: 1000, size: 500 });
    const result = await cache.get('/tmp/a.jsonl', 'key', { mtimeMs: 1000, size: 500 });
    expect(mockParser).toHaveBeenCalledOnce();
    expect(result).toBe(data);
  });

  it('re-parses on mtime change', async () => {
    const cache = new TranscriptCache(mockParser, { max: 10 });
    mockParser.mockResolvedValueOnce({ meta: makeMeta('v1'), messages: [] });
    mockParser.mockResolvedValueOnce({ meta: makeMeta('v2'), messages: [] });
    await cache.get('/tmp/a.jsonl', 'key', { mtimeMs: 1000, size: 500 });
    const result = await cache.get('/tmp/a.jsonl', 'key', { mtimeMs: 2000, size: 500 });
    expect(mockParser).toHaveBeenCalledTimes(2);
    expect(result.meta.model).toBe('v2');
  });

  it('re-parses on size change', async () => {
    const cache = new TranscriptCache(mockParser, { max: 10 });
    mockParser.mockResolvedValueOnce({ meta: makeMeta('v1'), messages: [] });
    mockParser.mockResolvedValueOnce({ meta: makeMeta('v2'), messages: [] });
    await cache.get('/tmp/a.jsonl', 'key', { mtimeMs: 1000, size: 500 });
    const result = await cache.get('/tmp/a.jsonl', 'key', { mtimeMs: 1000, size: 600 });
    expect(mockParser).toHaveBeenCalledTimes(2);
    expect(result.meta.model).toBe('v2');
  });

  it('deduplicates concurrent requests for same file', async () => {
    const cache = new TranscriptCache(mockParser, { max: 10 });
    let resolveParser!: (v: ParseResult) => void;
    mockParser.mockReturnValueOnce(
      new Promise((r) => {
        resolveParser = r;
      }),
    );

    const p1 = cache.get('/tmp/a.jsonl', 'key', { mtimeMs: 1000, size: 500 });
    const p2 = cache.get('/tmp/a.jsonl', 'key', { mtimeMs: 1000, size: 500 });

    resolveParser({ meta: makeMeta('test'), messages: [] });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(mockParser).toHaveBeenCalledOnce();
    expect(r1).toBe(r2);
  });
});
