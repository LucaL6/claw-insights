/**
 * Tail repair – JSONL integrity check on startup (§8).
 *
 * Validates that the last line of each active segment is complete JSON.
 * If truncated, the partial tail is removed and a metric is emitted.
 */
import { open } from 'node:fs/promises';

import type { LogStream } from './types.js';

export interface IntegrityConfig {
  logDir: string;
}

export interface TailRepairResult {
  stream: LogStream;
  file: string;
  truncatedBytes: number;
  wasRepaired: boolean;
}

export class LogIntegrity {
  private readonly config: IntegrityConfig;
  readonly repairResults: TailRepairResult[] = [];

  constructor(config: IntegrityConfig) {
    this.config = config;
  }

  /** Reserved — returns the log directory for future repair strategies. */
  get logDir(): string {
    return this.config.logDir;
  }

  /**
   * Repair a single file's tail. If the last line is not valid JSON,
   * truncate the file to the last valid newline boundary.
   */
  async repairTail(stream: LogStream, filePath: string): Promise<TailRepairResult> {
    const fh = await open(filePath, 'r+');
    try {
      const { size } = await fh.stat();
      if (size === 0) {
        return { stream, file: filePath, truncatedBytes: 0, wasRepaired: false };
      }

      const buf = Buffer.alloc(size);
      await fh.read(buf, 0, size, 0);
      const content = buf.toString('utf-8');

      // Walk lines, find the byte offset up to the last valid JSON line.
      let validEnd = 0;
      let pos = 0;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineByteLen = Buffer.byteLength(line, 'utf-8');

        if (line.trim() === '') {
          // Empty segment (trailing newline or blank line) – include it.
          pos += lineByteLen + (i < lines.length - 1 ? 1 : 0);
          validEnd = pos;
          continue;
        }

        try {
          JSON.parse(line);
          pos += lineByteLen + (i < lines.length - 1 ? 1 : 0);
          validEnd = pos;
        } catch {
          // Invalid line – stop here.
          break;
        }
      }

      if (validEnd > size) {
        validEnd = size;
      }

      const truncatedBytes = size - validEnd;
      if (truncatedBytes > 0) {
        await fh.truncate(validEnd);
        const result: TailRepairResult = { stream, file: filePath, truncatedBytes, wasRepaired: true };
        this.repairResults.push(result);
        return result;
      }

      return { stream, file: filePath, truncatedBytes: 0, wasRepaired: false };
    } finally {
      await fh.close();
    }
  }

  /**
   * Repair all active segment files on startup.
   */
  async repairAllActive(activeFiles: Array<{ stream: LogStream; path: string }>): Promise<TailRepairResult[]> {
    const results: TailRepairResult[] = [];
    for (const { stream, path } of activeFiles) {
      results.push(await this.repairTail(stream, path));
    }
    return results;
  }

  /** Number of files that were repaired (tailRepairCount metric). */
  get tailRepairCount(): number {
    return this.repairResults.filter((r) => r.wasRepaired).length;
  }
}
