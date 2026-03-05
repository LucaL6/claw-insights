import LRUCache from 'lru-cache';

import type { ParsedMessage, TranscriptMeta } from './transcript-parser.js';

export interface ParseResult {
  meta: TranscriptMeta;
  messages: ParsedMessage[];
}

export interface FileFingerprint {
  mtimeMs: number;
  size: number;
}

export type TranscriptParser = (filePath: string, sessionKey: string) => Promise<ParseResult>;

interface CacheEntry {
  fingerprint: FileFingerprint;
  data: ParseResult;
}

function sameFingerprint(a: FileFingerprint, b: FileFingerprint): boolean {
  return a.mtimeMs === b.mtimeMs && a.size === b.size;
}

export class TranscriptCache {
  private cache: LRUCache<string, CacheEntry>;

  private inFlight = new Map<string, Promise<ParseResult>>();

  constructor(
    private parser: TranscriptParser,
    options?: ConstructorParameters<typeof LRUCache<string, CacheEntry>>[0],
  ) {
    this.cache = new LRUCache<string, CacheEntry>({
      max: 50,
      ...options,
    });
  }

  async get(filePath: string, sessionKey: string, fingerprint: FileFingerprint): Promise<ParseResult> {
    const cached = this.cache.get(filePath);
    if (cached && sameFingerprint(cached.fingerprint, fingerprint)) {
      return cached.data;
    }

    const existing = this.inFlight.get(filePath);
    if (existing) {
      return existing;
    }

    const parsingPromise = this.parser(filePath, sessionKey)
      .then((data) => {
        this.cache.set(filePath, { fingerprint, data });
        return data;
      })
      .finally(() => {
        this.inFlight.delete(filePath);
      });

    this.inFlight.set(filePath, parsingPromise);
    return parsingPromise;
  }
}
