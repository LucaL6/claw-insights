import { open, stat } from 'node:fs/promises';
import { basename } from 'node:path';

import { createChildLogger } from '../../../../logger.js';
import type { FileResult, FileTask } from '../types.js';
import { createUsageNormalizer, parseLine } from './parser.js';

const log = createChildLogger('transcript-processor');

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export interface ReadFileChunkOptions {
  maxBytes: number;
}

export interface ReadFileChunkResult {
  lines: string[];
  partial: string;
  bytesRead: number;
  newOffset: number;
  inode: number;
  birthtimeMs: number;
  mtimeMs: number;
}

export interface ProcessFileOptions {
  maxBytes?: number;
}

export async function readFileChunk(
  path: string,
  offset: number,
  prevPartial: string,
  opts: ReadFileChunkOptions,
): Promise<ReadFileChunkResult> {
  const st = await stat(path);
  if (st.size === 0 || offset >= st.size) {
    return {
      lines: [],
      partial: '',
      bytesRead: 0,
      newOffset: st.size,
      inode: st.ino,
      birthtimeMs: st.birthtimeMs,
      mtimeMs: st.mtimeMs,
    };
  }

  const toRead = Math.min(st.size - offset, opts.maxBytes);
  const buffer = Buffer.alloc(toRead);

  const handle = await open(path, 'r');
  try {
    const { bytesRead } = await handle.read(buffer, 0, toRead, offset);
    const raw = buffer.subarray(0, bytesRead).toString('utf-8');

    const text = prevPartial + raw;
    const reachedEof = offset + bytesRead >= st.size;
    const segments = text.split('\n');

    let partial = '';
    let lines = segments;

    if (text.endsWith('\n')) {
      // split() on trailing newline leaves a final empty segment
      lines = segments.slice(0, -1);
      partial = '';
    } else {
      partial = segments[segments.length - 1] ?? '';
      if (reachedEof) {
        // Match streamScanFile behavior at EOF without trailing newline:
        // last line is parsed AND retained as partial.
        lines = segments;
      } else {
        // Mid-file chunk boundary: hold incomplete tail for next chunk.
        lines = segments.slice(0, -1);
      }
    }

    return {
      lines: lines.filter((line) => line.length > 0),
      partial,
      bytesRead,
      newOffset: offset + bytesRead,
      inode: st.ino,
      birthtimeMs: st.birthtimeMs,
      mtimeMs: st.mtimeMs,
    };
  } finally {
    await handle.close();
  }
}

export async function processFile(task: FileTask, opts?: ProcessFileOptions): Promise<FileResult> {
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const fileName = basename(task.path);

  const currentStat = await stat(task.path);

  let effectiveOffset = task.offset;
  let effectivePartial = task.partial;

  const inodeMismatch = task.inode !== undefined && currentStat.ino !== task.inode;
  const offsetExceedsSize = task.offset > currentStat.size;
  const birthtimeMismatch = task.birthtimeMs !== undefined && currentStat.birthtimeMs !== task.birthtimeMs;

  if (inodeMismatch || offsetExceedsSize || birthtimeMismatch) {
    log.info(
      { file: fileName, reason: inodeMismatch ? 'inode' : (offsetExceedsSize ? 'offset' : 'birthtime') },
      'file reset detected',
    );
    effectiveOffset = 0;
    effectivePartial = '';
  }

  const chunk = await readFileChunk(task.path, effectiveOffset, effectivePartial, { maxBytes });

  const normalize = createUsageNormalizer();
  const tokens: FileResult['tokens'] = [];
  const messages: FileResult['messages'] = [];

  let discoveredFirstTimestampMs: number | null = null;

  for (const line of chunk.lines) {
    const parsed = parseLine(line, task.sessionKey, normalize);
    if (!parsed) {
      continue;
    }

    const ts = parsed.token?.timestamp ?? parsed.message?.timestamp;
    if (discoveredFirstTimestampMs === null && ts) {
      const ms = new Date(ts).getTime();
      if (Number.isFinite(ms) && ms > 0) {
        discoveredFirstTimestampMs = ms;
      }
    }

    if (parsed.token) {
      tokens.push(parsed.token);
    }
    if (parsed.message) {
      messages.push(parsed.message);
    }
  }

  const firstTimestampMs = effectiveOffset === 0
    ? (discoveredFirstTimestampMs ?? task.prevFirstTimestampMs)
    : task.prevFirstTimestampMs;

  return {
    task,
    tokens,
    messages,
    firstTimestampMs,
    newState: {
      offset: chunk.newOffset,
      inode: chunk.inode,
      birthtimeMs: chunk.birthtimeMs,
      mtimeMs: chunk.mtimeMs,
      partial: chunk.partial,
      firstTimestampMs,
    },
  };
}
