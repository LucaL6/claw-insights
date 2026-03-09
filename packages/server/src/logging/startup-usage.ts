import type { LogStream } from './types.js';

export interface FsAdapter {
  readdirSync: (dir: string) => string[];
  statSync: (path: string) => { size: number; mtimeMs: number };
  existsSync: (path: string) => boolean;
}

export interface UsageSeed {
  totalBytes: number;
  byStream: Record<string, number>;
  warnings: string[];
}

// Matches: stream.log, stream.log.N, stream.YYYY-MM-DD.NNNN.log
const LOG_FILE_RE = /^(app|error|debug|noise|security)(?:\.\d{4}-\d{2}-\d{2}\.\d+)?\.log(?:\.\d+)?$/;

function streamFromFilename(name: string): LogStream | null {
  const m = LOG_FILE_RE.exec(name);
  return m ? (m[1] as LogStream) : null;
}

export function seedUsageFromDisk(logDir: string, fs: FsAdapter): UsageSeed {
  const byStream: Record<string, number> = {};
  const warnings: string[] = [];
  let totalBytes = 0;

  let files: string[];
  try {
    files = fs.readdirSync(logDir);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    warnings.push(`${code ?? 'UNKNOWN'}: cannot read log directory ${logDir}`);
    return { totalBytes: 0, byStream, warnings };
  }

  for (const name of files) {
    const stream = streamFromFilename(name);
    if (!stream) {
      continue;
    }

    try {
      const stat = fs.statSync(`${logDir}/${name}`);
      byStream[stream] = (byStream[stream] ?? 0) + stat.size;
      totalBytes += stat.size;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      warnings.push(`${code ?? 'UNKNOWN'}: cannot stat ${name}`);
    }
  }

  return { totalBytes, byStream, warnings };
}
