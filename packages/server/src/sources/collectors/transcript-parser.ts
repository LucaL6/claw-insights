import { createHash } from 'node:crypto';

import { createChildLogger } from '../../logger.js';

const log = createChildLogger('transcript-parser');

export interface NormalizedUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ParsedTokenEvent {
  timestamp: string;
  sessionKey: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ParsedMessageEvent {
  timestamp: string;
  sessionKey: string;
  role: string;
  lineHash: string;
}

export interface ParsedLine {
  token?: ParsedTokenEvent;
  message?: ParsedMessageEvent;
  userMessages?: number;
  assistantMessages?: number;
  usage?: NormalizedUsage;
}

export function parseLine(
  raw: string,
  sessionKey: string,
  normalize: (raw: unknown) => NormalizedUsage | null = normalizeUsage,
): ParsedLine | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (parsed.type !== 'message') {
    return null;
  }

  const message = parsed.message as Record<string, unknown> | undefined;
  if (!message) {
    return null;
  }

  const role = message.role;
  const ts = parsed.timestamp as string | undefined;
  if (!ts) {
    log.warn({ sessionKey }, 'skipping line: missing timestamp');
    return null;
  }

  // 8-char fingerprint of raw line for dedup disambiguation
  const lineHash = createHash('sha256').update(raw).digest('hex').slice(0, 8);

  const result: ParsedLine = {};

  if (role === 'user') {
    result.userMessages = 1;
    result.message = { timestamp: ts, sessionKey, role: 'user', lineHash };
    return result;
  }

  if (role === 'assistant') {
    result.assistantMessages = 1;
    result.message = { timestamp: ts, sessionKey, role: 'assistant', lineHash };

    const usage = normalize((message.usage as Record<string, unknown>) ?? (parsed.usage as Record<string, unknown>));
    if (!usage) {
      return result;
    }

    result.usage = usage;

    const rawModel = message.model as string | undefined;
    const model = rawModel || `unknown:${lineHash}`;

    result.token = {
      timestamp: ts,
      sessionKey,
      model,
      inputTokens: usage.input,
      outputTokens: usage.output,
      cacheReadTokens: usage.cacheRead,
      cacheWriteTokens: usage.cacheWrite,
    };
    return result;
  }

  if (role === 'toolResult') {
    result.message = { timestamp: ts, sessionKey, role: 'tool', lineHash };
    return result;
  }

  return null;
}

export function createUsageNormalizer(): (raw: unknown) => NormalizedUsage | null {
  let warnCount = 0;

  return (raw: unknown): NormalizedUsage | null => {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const r = raw as Record<string, unknown>;

    const input = toNum(r.input ?? r.inputTokens ?? r.prompt_tokens ?? r.input_tokens);
    const output = toNum(r.output ?? r.outputTokens ?? r.completion_tokens ?? r.output_tokens);
    const cacheRead = toNum(r.cacheRead ?? r.cache_read_input_tokens);
    const cacheWrite = toNum(r.cacheWrite ?? r.cache_creation_input_tokens);

    if (input === 0 && output === 0 && Object.keys(r).length > 0) {
      warnCount++;
      if (warnCount <= 5) {
        log.warn({ keys: Object.keys(r) }, 'unrecognized usage format');
      }
    }

    return { input, output, cacheRead, cacheWrite };
  };
}

export const normalizeUsage = createUsageNormalizer();

export function contentHash(timestamp: string, sessionKey: string, discriminator: string): string {
  return createHash('sha256').update(`${timestamp}|${sessionKey}|${discriminator}`).digest('hex').slice(0, 16);
}

function toNum(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  return 0;
}
