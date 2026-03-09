import { promises as fs } from 'fs';

import { TranscriptCache } from './transcript-cache.js';
import { type PageInfo, paginate } from './transcript-paginator.js';
import { type ParsedMessage, parseTranscript } from './transcript-parser.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

const cache = new TranscriptCache(parseTranscript, {
  max: 50,
  maxSize: 200_000,
  sizeCalculation: (entry: { data: { messages: unknown[] } }) => entry.data.messages.length || 1,
});

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
  pageInfo: PageInfo;
}

export type TranscriptMessage = ParsedMessage;

function parseDisplayName(sessionKey: string): string {
  const parts = sessionKey.split(':');
  const last = parts[parts.length - 1];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(last)) {
    return `subagent:${last.slice(0, 8)}`;
  }
  return last;
}

export async function readTranscript(
  filePath: string,
  sessionKey: string,
  options: { limit?: number; before?: string; after?: string } = {},
): Promise<TranscriptReadResult> {
  const limit = Math.max(0, Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT));

  const stat = await fs.stat(filePath);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})`);
  }

  const parsed = await cache.get(filePath, sessionKey, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
  });

  const page = paginate(parsed.messages as (ParsedMessage & Record<string, unknown>)[], {
    limit,
    before: options.before,
    after: options.after,
  });

  const isSubAgent = sessionKey.includes('subagent');

  return {
    sessionKey,
    displayName: parseDisplayName(sessionKey),
    model: parsed.meta.model,
    channel: parsed.meta.channel,
    kind: parsed.meta.kind,
    thinkingLevel: parsed.meta.thinkingLevel,
    startedAt: parsed.meta.startedAt,
    fileSize: stat.size,
    totalTokens: parsed.meta.totalTokens,
    contextTokens: parsed.meta.contextTokens,
    durationMs: parsed.meta.durationMs,
    isSubAgent,
    parentDisplayName: isSubAgent ? parseDisplayName(sessionKey.replace(/:subagent:[^:]*$/, '')) : null,
    spawnPrompt: isSubAgent ? parsed.meta.firstUserContent : null,
    messages: page.messages,
    totalMessages: parsed.messages.length,
    pageInfo: page.pageInfo,
  };
}
