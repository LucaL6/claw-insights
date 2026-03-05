export interface CursorData {
  ts: string;
  seq: number;
}

export function encodeCursor(ts: string, seq: number): string {
  return Buffer.from(JSON.stringify({ ts, seq })).toString('base64url');
}

export function decodeCursor(cursor: string): CursorData | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (typeof parsed.ts !== 'string' || typeof parsed.seq !== 'number') {
      return null;
    }
    return { ts: parsed.ts, seq: parsed.seq };
  } catch {
    return null;
  }
}

export function compareCursors(a: CursorData, b: CursorData): number {
  if (a.ts < b.ts) {
    return -1;
  }
  if (a.ts > b.ts) {
    return 1;
  }
  return a.seq - b.seq;
}
