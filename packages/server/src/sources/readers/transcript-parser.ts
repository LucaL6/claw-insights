import { createReadStream } from 'fs';
import { stat as fsStat } from 'fs/promises';
import { createInterface } from 'readline';

import { createChildLogger } from '../../logger.js';

const log = createChildLogger('transcript-parser');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const CONTENT_LIMIT_USER_ASSISTANT = 4000;
const CONTENT_LIMIT_TOOL = 1000;
const EPOCH_ZERO = '1970-01-01T00:00:00.000Z';

export interface TranscriptMessage {
  timestamp: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  contentTruncated: boolean;
  model?: string;
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  toolName?: string;
}

export interface ParsedMessage extends TranscriptMessage {
  seq: number;
}

export interface TranscriptMeta {
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

interface JsonLine {
  type: string;
  timestamp?: string;
  channel?: string;
  group?: string;
  modelId?: string;
  thinkingLevel?: string;
  message?: {
    role?: string;
    content?: unknown;
    model?: string;
    toolName?: string;
    usage?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cacheReadInputTokens?: number;
      cache_creation_input_tokens?: number;
      cacheCreationInputTokens?: number;
    };
    name?: string;
    timestamp?: number;
  };
}

interface ContentBlock {
  type: string;
  text?: string;
}

function extractContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return (content as ContentBlock[])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n');
  }
  return '';
}

function truncateContent(
  content: string,
  role: 'user' | 'assistant' | 'tool',
): { content: string; truncated: boolean } {
  const limit = role === 'tool' ? CONTENT_LIMIT_TOOL : CONTENT_LIMIT_USER_ASSISTANT;
  if (content.length > limit) {
    return { content: content.slice(0, limit), truncated: true };
  }
  return { content, truncated: false };
}

export async function parseTranscript(
  filePath: string,
  sessionKey: string,
): Promise<{ meta: TranscriptMeta; messages: ParsedMessage[] }> {
  const stat = await fsStat(filePath);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})`);
  }

  let model = '';
  let thinkingLevel: string | null = null;
  let startedAt = '';
  let lastTimestamp = '';
  let channel: string | null = null;
  let kind = 'direct';
  let firstUserContent: string | null = null;
  let totalTokens = 0;
  let contextTokens = 0;
  const messages: ParsedMessage[] = [];

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    let parsed: JsonLine;
    try {
      parsed = JSON.parse(line) as JsonLine;
    } catch {
      log.warn('Skipping malformed JSON line');
      continue;
    }

    const type = parsed.type;

    if (type === 'session') {
      if (!startedAt && parsed.timestamp) {
        startedAt = parsed.timestamp;
      }
      if (parsed.channel) {
        channel = parsed.channel;
      }
      if (parsed.group) {
        kind = parsed.group;
      }
      continue;
    }

    if (type === 'model_change') {
      if (parsed.modelId) {
        model = parsed.modelId;
      }
      continue;
    }

    if (type === 'thinking_level_change') {
      if (thinkingLevel === null && parsed.thinkingLevel) {
        thinkingLevel = parsed.thinkingLevel;
      }
      continue;
    }

    if (type !== 'message' || !parsed.message) {
      continue;
    }

    const inner = parsed.message;
    const role = inner.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'toolResult') {
      continue;
    }

    const mappedRole: 'user' | 'assistant' | 'tool' = role === 'toolResult' ? 'tool' : role;
    const rawContent = extractContent(inner.content);
    const { content, truncated } = truncateContent(rawContent, mappedRole);

    if (role === 'user' && firstUserContent === null) {
      firstUserContent = rawContent;
    }

    const rawTs = inner.timestamp ? new Date(inner.timestamp).toISOString() : parsed.timestamp || '';
    const ts = rawTs || lastTimestamp || EPOCH_ZERO;

    if (!startedAt && ts) {
      startedAt = ts;
    }
    if (role === 'assistant' && inner.model) {
      model = inner.model;
    }

    const msg: ParsedMessage = {
      timestamp: ts,
      seq: messages.length,
      role: mappedRole,
      content,
      contentTruncated: truncated,
    };

    if (role === 'assistant' && inner.model) {
      msg.model = inner.model;
    }
    if (role === 'assistant' && inner.usage) {
      const u = inner.usage;
      const input = u.input ?? u.input_tokens ?? 0;
      const output = u.output ?? u.output_tokens ?? 0;
      const cacheRead = u.cacheRead ?? u.cache_read_input_tokens ?? u.cacheReadInputTokens ?? 0;
      const cacheWrite = u.cacheWrite ?? u.cache_creation_input_tokens ?? u.cacheCreationInputTokens ?? 0;
      msg.usage = { input, output, cacheRead, cacheWrite };
      totalTokens += input + output + cacheRead;
      contextTokens = input + cacheRead;
    }
    if (role === 'toolResult') {
      msg.toolName = inner.toolName || inner.name || 'tool';
    }

    lastTimestamp = ts;
    messages.push(msg);
  }

  if (sessionKey.includes(':cron:')) {
    kind = 'cron';
  }

  return {
    meta: {
      model: model || 'unknown',
      channel,
      kind,
      thinkingLevel,
      startedAt,
      totalTokens,
      contextTokens,
      durationMs: startedAt && lastTimestamp ? new Date(lastTimestamp).getTime() - new Date(startedAt).getTime() : 0,
      firstUserContent,
    },
    messages,
  };
}
