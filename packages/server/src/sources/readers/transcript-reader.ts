import { createReadStream, statSync } from 'fs';
import { createInterface } from 'readline';

import { createChildLogger } from '../../logger.js';

const log = createChildLogger('transcript-reader');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;
const CONTENT_LIMIT_USER_ASSISTANT = 4000;
const CONTENT_LIMIT_TOOL = 1000;

export interface TranscriptReadResult {
  sessionKey: string;
  displayName: string;
  model: string;
  channel: string | null;
  kind: string;
  thinkingLevel: string | null;
  startedAt: string;
  fileSize: number;
  totalTokens: number;
  /** Input tokens of the last assistant message (≈ current context window usage) */
  contextTokens: number;
  durationMs: number;
  isSubAgent: boolean;
  parentDisplayName: string | null;
  spawnPrompt: string | null;
  messages: TranscriptMessage[];
  totalMessages: number;
  hasMore: boolean;
}

export interface TranscriptMessage {
  timestamp: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  contentTruncated: boolean;
  model?: string;
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  toolName?: string;
}

interface JsonLine {
  type: string;
  id?: string;
  timestamp?: string;
  cwd?: string;
  version?: string;
  channel?: string;
  group?: string;
  provider?: string;
  modelId?: string;
  thinkingLevel?: string;
  // message lines nest content inside a `message` envelope
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
      // snake_case variants from raw transcripts
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

function parseDisplayName(sessionKey: string): string {
  const parts = sessionKey.split(':');
  const last = parts[parts.length - 1];
  // If last segment looks like a UUID, shorten it
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(last)) {
    return `subagent:${last.slice(0, 8)}`;
  }
  return last;
}

export async function readTranscript(
  filePath: string,
  sessionKey: string,
  options: { limit?: number; offset?: number } = {},
): Promise<TranscriptReadResult> {
  const limit = Math.max(0, Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  const offset = Math.max(0, options.offset ?? 0);

  // Check file size
  const stat = statSync(filePath);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})`);
  }

  // Single pass: collect metadata + all messages
  let model = '';
  let thinkingLevel: string | null = null;
  let startedAt = '';
  let lastTimestamp = '';
  let channel: string | null = null;
  let kind = 'direct';
  let firstUserContent: string | null = null;
  let totalTokens = 0;
  let contextTokens = 0;
  const allMessages: TranscriptMessage[] = [];

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
    } else if (type === 'model_change') {
      if (!model && parsed.modelId) {
        model = parsed.modelId;
      }
    } else if (type === 'thinking_level_change') {
      if (thinkingLevel === null && parsed.thinkingLevel) {
        thinkingLevel = parsed.thinkingLevel;
      }
    } else if (type === 'message') {
      const inner = parsed.message;
      if (!inner) {
        continue;
      }
      const role = inner.role;
      if (role === 'user' || role === 'assistant' || role === 'toolResult') {
        const mappedRole: 'user' | 'assistant' | 'tool' = role === 'toolResult' ? 'tool' : role;
        const rawContent = extractContent(inner.content);
        const { content, truncated } = truncateContent(rawContent, mappedRole);

        if (role === 'user' && firstUserContent === null) {
          firstUserContent = rawContent;
        }

        // timestamp: prefer inner.timestamp (epoch ms), fall back to outer parsed.timestamp (ISO)
        const ts = inner.timestamp ? new Date(inner.timestamp).toISOString() : parsed.timestamp || '';

        if (!startedAt && ts) {
          startedAt = ts;
        }
        if (!model && role === 'assistant' && inner.model) {
          model = inner.model;
        }

        const msg: TranscriptMessage = {
          timestamp: ts,
          role: mappedRole,
          content,
          contentTruncated: truncated,
        };

        if (role === 'assistant' && inner.model) {
          msg.model = inner.model;
        }
        if (role === 'assistant' && inner.usage) {
          const u = inner.usage;
          // Normalize both camelCase and snake_case usage keys
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

        if (ts) {
          lastTimestamp = ts;
        }
        allMessages.push(msg);
      }
    }
  }

  if (sessionKey.includes(':cron:')) {
    kind = 'cron';
  }

  const isSubAgent = sessionKey.includes('subagent');
  const totalMessages = allMessages.length;
  const paginatedMessages = allMessages.slice(offset, offset + limit);

  return {
    sessionKey,
    displayName: parseDisplayName(sessionKey),
    model: model || 'unknown',
    channel,
    kind,
    thinkingLevel,
    startedAt,
    fileSize: stat.size,
    totalTokens,
    contextTokens,
    durationMs: startedAt && lastTimestamp ? new Date(lastTimestamp).getTime() - new Date(startedAt).getTime() : 0,
    isSubAgent,
    parentDisplayName: isSubAgent ? parseDisplayName(sessionKey.replace(/:subagent:[^:]*$/, '')) : null,
    spawnPrompt: isSubAgent ? firstUserContent : null,
    messages: paginatedMessages,
    totalMessages,
    hasMore: offset + limit < totalMessages,
  };
}
