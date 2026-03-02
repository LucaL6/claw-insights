import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { processFile } from '../processing/processor.js';

const GOLDEN_DIR = join(__dirname, 'fixtures/golden');
const baseline = JSON.parse(readFileSync(join(GOLDEN_DIR, 'baseline.json'), 'utf-8'));

interface BaselineEvent {
  kind: string;
  timestamp: string;
  sessionKey: string;
  role?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  lineHash?: string;
}

interface BaselineEntry {
  events: BaselineEvent[];
  finalOffset: number;
  partial: string;
  firstTimestampMs: number | null;
}

describe('golden dataset baseline (processFile)', () => {
  for (const [filename, expected] of Object.entries(baseline) as [string, BaselineEntry][]) {
    it(`matches baseline tokens/messages in callback order per file: ${filename}`, async () => {
      const result = await processFile({
        path: join(GOLDEN_DIR, filename),
        offset: 0,
        partial: '',
        sessionKey: filename.replace(/\.jsonl$/, ''),
        prevFirstTimestampMs: null,
      });

      const expectedTokens = expected.events
        .filter((e) => e.kind === 'token')
        .map((e) => ({
          timestamp: e.timestamp,
          sessionKey: e.sessionKey,
          model: e.model ?? 'unknown',
          inputTokens: e.inputTokens ?? 0,
          outputTokens: e.outputTokens ?? 0,
          cacheReadTokens: e.cacheReadTokens ?? 0,
          cacheWriteTokens: e.cacheWriteTokens ?? 0,
        }));

      const expectedMessages = expected.events
        .filter((e) => e.kind === 'message')
        .map((e) => ({
          timestamp: e.timestamp,
          sessionKey: e.sessionKey,
          role: e.role ?? 'user',
          lineHash: e.lineHash ?? '',
        }));

      expect(result.tokens).toEqual(expectedTokens);
      expect(result.messages).toEqual(expectedMessages);
      expect(result.newState.offset).toBe(expected.finalOffset);
      expect(result.newState.partial).toBe(expected.partial);
      expect(result.newState.firstTimestampMs).toBe(expected.firstTimestampMs);
    });
  }
});
