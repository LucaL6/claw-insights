import { closeSync, createReadStream, openSync, readSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';

import type { ParsedMessageEvent, ParsedTokenEvent } from './transcript-parser.js';
import { createUsageNormalizer, parseLine } from './transcript-parser.js';

export interface StreamScanResult {
  newOffset: number;
  partial: string;
  birthtimeMs: number;
  inode: number;
  mtimeMs: number;
  firstTimestampMs: number | null;
}

/**
 * Stream-scan a single .jsonl transcript file from a byte offset.
 * Uses readline (not readFileSync) for bounded memory usage (~64KB buffer).
 */
export async function streamScanFile(
  file: string,
  offset: number,
  partial: string,
  onToken: (event: ParsedTokenEvent) => void,
  onMessage: (event: ParsedMessageEvent) => void,
): Promise<StreamScanResult> {
  const st = statSync(file);
  if (st.size === 0 || offset >= st.size) {
    return {
      newOffset: st.size,
      partial: '',
      birthtimeMs: st.birthtimeMs,
      inode: st.ino,
      mtimeMs: st.mtimeMs,
      firstTimestampMs: null,
    };
  }

  const sessionKey = basename(file, '.jsonl');
  const normalize = createUsageNormalizer();
  let isFirstLine = true;
  let lastProcessedLine = '';
  let firstTimestampMs: number | null = null;

  const stream = createReadStream(file, { start: offset, encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const rawLine of rl) {
      let line = rawLine;
      if (isFirstLine) {
        if (partial) {
          line = partial + rawLine;
        }
        isFirstLine = false;
      }
      lastProcessedLine = line;

      if (!line.trim()) {
        continue;
      }

      const result = parseLine(line, sessionKey, normalize);
      if (!result) {
        continue;
      }

      if (firstTimestampMs === null) {
        const ts = result.token?.timestamp ?? result.message?.timestamp;
        if (ts) {
          const ms = new Date(ts).getTime();
          if (Number.isFinite(ms) && ms > 0) {
            firstTimestampMs = ms;
          }
        }
      }

      if (result.token) {
        onToken(result.token);
      }
      if (result.message) {
        onMessage(result.message);
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  const finalSt = statSync(file);
  const buf = Buffer.alloc(1);
  let endsWithNewline = true;
  if (finalSt.size > 0) {
    const fd = openSync(file, 'r');
    try {
      readSync(fd, buf, 0, 1, finalSt.size - 1);
      endsWithNewline = buf[0] === 0x0a;
    } finally {
      closeSync(fd);
    }
  }

  return {
    newOffset: finalSt.size,
    partial: endsWithNewline ? '' : lastProcessedLine,
    birthtimeMs: st.birthtimeMs,
    inode: st.ino,
    mtimeMs: finalSt.mtimeMs,
    firstTimestampMs: offset === 0 ? firstTimestampMs : null,
  };
}
