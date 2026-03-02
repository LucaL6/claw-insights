import { describe, expect, it } from 'vitest';

import { contentHash, createUsageNormalizer, normalizeUsage, parseLine } from '../processing/parser';

function line(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

describe('transcript-parser', () => {
  describe('parseLine', () => {
    it('parses user/assistant/toolResult and skips unknown roles', () => {
      const sessionKey = 'sess-1';

      const user = parseLine(
        line({ type: 'message', timestamp: '2025-01-01T00:00:00Z', message: { role: 'user', content: 'hi' } }),
        sessionKey,
      );
      expect(user).toEqual({
        userMessages: 1,
        message: { timestamp: '2025-01-01T00:00:00Z', sessionKey, role: 'user', lineHash: expect.any(String) },
      });

      const assistant = parseLine(
        line({
          type: 'message',
          timestamp: '2025-01-01T00:00:01Z',
          message: { role: 'assistant', model: 'claude-3', usage: { input: 10, output: 5 } },
        }),
        sessionKey,
      );
      expect(assistant?.assistantMessages).toBe(1);
      expect(assistant?.token?.model).toBe('claude-3');
      expect(assistant?.usage).toEqual({ input: 10, output: 5, cacheRead: 0, cacheWrite: 0 });

      const tool = parseLine(
        line({ type: 'message', timestamp: '2025-01-01T00:00:02Z', message: { role: 'toolResult' } }),
        sessionKey,
      );
      expect(tool).toEqual({
        message: { timestamp: '2025-01-01T00:00:02Z', sessionKey, role: 'tool', lineHash: expect.any(String) },
      });

      const unknown = parseLine(
        line({ type: 'message', timestamp: '2025-01-01T00:00:03Z', message: { role: 'system' } }),
        sessionKey,
      );
      expect(unknown).toBeNull();
    });

    it('returns null for non-message, malformed JSON, missing message', () => {
      expect(parseLine(line({ type: 'session' }), 's1')).toBeNull();
      expect(parseLine('{nope', 's1')).toBeNull();
      expect(parseLine(line({ type: 'message', timestamp: '2025-01-01T00:00:00Z' }), 's1')).toBeNull();
    });

    it('uses unknown:<hash8> fallback model and differs for different usage values', () => {
      const ts = '2025-01-01T00:00:01Z';
      const a = parseLine(
        line({ type: 'message', timestamp: ts, message: { role: 'assistant', usage: { input: 10, output: 1 } } }),
        'sess-fallback',
      );
      const b = parseLine(
        line({ type: 'message', timestamp: ts, message: { role: 'assistant', usage: { input: 11, output: 1 } } }),
        'sess-fallback',
      );

      expect(a?.token?.model).toMatch(/^unknown:[0-9a-f]{8}$/);
      expect(b?.token?.model).toMatch(/^unknown:[0-9a-f]{8}$/);
      expect(a?.token?.model).not.toBe(b?.token?.model);
    });

    it('returns null when timestamp is missing', () => {
      const parsed = parseLine(line({ type: 'message', message: { role: 'user' } }), 'sess-1');
      expect(parsed).toBeNull();
    });

    it('produces different lineHash for same ts/session/role but different content', () => {
      const ts = '2025-01-01T00:00:00Z';
      const a = parseLine(
        line({ type: 'message', timestamp: ts, message: { role: 'toolResult', content: 'result-a' } }),
        'sess-1',
      );
      const b = parseLine(
        line({ type: 'message', timestamp: ts, message: { role: 'toolResult', content: 'result-b' } }),
        'sess-1',
      );
      expect(a?.message?.lineHash).toMatch(/^[0-9a-f]{8}$/);
      expect(b?.message?.lineHash).toMatch(/^[0-9a-f]{8}$/);
      expect(a?.message?.lineHash).not.toBe(b?.message?.lineHash);
    });

    it('produces different fallback models for model-less lines with different content', () => {
      const ts = '2025-01-01T00:00:01Z';
      const a = parseLine(
        line({
          type: 'message',
          timestamp: ts,
          message: { role: 'assistant', content: 'a', usage: { input: 10, output: 1 } },
        }),
        'sess-fallback',
      );
      const b = parseLine(
        line({
          type: 'message',
          timestamp: ts,
          message: { role: 'assistant', content: 'b', usage: { input: 10, output: 1 } },
        }),
        'sess-fallback',
      );
      expect(a?.token?.model).toMatch(/^unknown:[0-9a-f]{8}$/);
      expect(b?.token?.model).toMatch(/^unknown:[0-9a-f]{8}$/);
      expect(a?.token?.model).not.toBe(b?.token?.model);
    });

    it('accepts injected normalizer', () => {
      const normalize = () => ({ input: 7, output: 3, cacheRead: 1, cacheWrite: 2 });
      const parsed = parseLine(
        line({ type: 'message', timestamp: '2025-01-01T00:00:01Z', message: { role: 'assistant', usage: { a: 1 } } }),
        'sess-custom',
        normalize,
      );
      expect(parsed?.token?.inputTokens).toBe(7);
      expect(parsed?.token?.cacheWriteTokens).toBe(2);
    });
  });

  describe('createUsageNormalizer / normalizeUsage', () => {
    it('warn counter is scoped per normalizer instance', () => {
      const a = createUsageNormalizer();
      const b = createUsageNormalizer();

      for (let i = 0; i < 10; i++) {
        a({ weird: true });
      }
      const resultB = b({ weird: true });
      expect(resultB).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    });

    it('normalizes Anthropic, OpenAI and snake_case formats', () => {
      expect(normalizeUsage({ input: 100, output: 50, cacheRead: 20, cacheWrite: 10 })).toEqual({
        input: 100,
        output: 50,
        cacheRead: 20,
        cacheWrite: 10,
      });

      expect(normalizeUsage({ prompt_tokens: 100, completion_tokens: 50 })).toEqual({
        input: 100,
        output: 50,
        cacheRead: 0,
        cacheWrite: 0,
      });

      expect(
        normalizeUsage({
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 20,
          cache_creation_input_tokens: 10,
        }),
      ).toEqual({ input: 100, output: 50, cacheRead: 20, cacheWrite: 10 });
    });
  });

  describe('contentHash', () => {
    it('is deterministic 16-char hex', () => {
      const h1 = contentHash('2025-01-01T00:00:00Z', 's1', 'x');
      const h2 = contentHash('2025-01-01T00:00:00Z', 's1', 'x');
      const h3 = contentHash('2025-01-01T00:00:00Z', 's1', 'y');

      expect(h1).toMatch(/^[0-9a-f]{16}$/);
      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
    });
  });
});
