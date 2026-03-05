import { GraphQLError } from 'graphql';

import { compareCursors, type CursorData, decodeCursor, encodeCursor } from './transcript-cursor.js';

export interface PaginatableMessage {
  timestamp: string;
  seq: number;
  [key: string]: unknown;
}

export interface PageInfo {
  startCursor: string | null;
  endCursor: string | null;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PaginateResult<T extends PaginatableMessage> {
  messages: T[];
  pageInfo: PageInfo;
}

export interface PaginateOptions {
  limit: number;
  before?: string;
  after?: string;
}

function decodeCursorOrThrow(cursor: string): CursorData {
  const decoded = decodeCursor(cursor);
  if (!decoded) {
    throw new GraphQLError('Invalid cursor', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return decoded;
}

export function paginate<T extends PaginatableMessage>(messages: T[], options: PaginateOptions): PaginateResult<T> {
  const { limit, before, after } = options;

  if (before && after) {
    throw new GraphQLError('Cannot specify both before and after', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  if (messages.length === 0) {
    return {
      messages: [],
      pageInfo: { startCursor: null, endCursor: null, hasPreviousPage: false, hasNextPage: false },
    };
  }

  let sliced: T[];
  let hasPreviousPage: boolean;
  let hasNextPage: boolean;

  if (before) {
    const cursorData = decodeCursorOrThrow(before);
    const filtered = messages.filter((m) => compareCursors({ ts: m.timestamp, seq: m.seq }, cursorData) < 0);
    sliced = filtered.slice(-limit);
    hasPreviousPage = filtered.length > limit;
    hasNextPage = messages.some((m) => compareCursors({ ts: m.timestamp, seq: m.seq }, cursorData) >= 0);
  } else if (after) {
    const cursorData = decodeCursorOrThrow(after);
    const filtered = messages.filter((m) => compareCursors({ ts: m.timestamp, seq: m.seq }, cursorData) > 0);
    sliced = filtered.slice(0, limit);
    hasNextPage = filtered.length > limit;
    hasPreviousPage = messages.some((m) => compareCursors({ ts: m.timestamp, seq: m.seq }, cursorData) <= 0);
  } else {
    sliced = messages.slice(-limit);
    hasPreviousPage = messages.length > limit;
    hasNextPage = false;
  }

  const startCursor = sliced.length > 0 ? encodeCursor(sliced[0].timestamp, sliced[0].seq) : null;
  const endCursor =
    sliced.length > 0 ? encodeCursor(sliced[sliced.length - 1].timestamp, sliced[sliced.length - 1].seq) : null;

  return {
    messages: sliced,
    pageInfo: { startCursor, endCursor, hasPreviousPage, hasNextPage },
  };
}
