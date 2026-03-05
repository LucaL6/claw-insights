import { describe, expect, it } from 'vitest';

import { encodeCursor } from '../transcript-cursor.js';
import { paginate } from '../transcript-paginator.js';

function makeMessages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: `2026-03-06T12:00:${String(i).padStart(2, '0')}.000Z`,
    seq: i,
    role: 'user' as const,
    content: `msg-${i}`,
    contentTruncated: false,
  }));
}

describe('transcript-paginator', () => {
  const msgs = makeMessages(10); // seq 0..9

  // --- Default (no cursor): tail ---
  it('no cursor → returns last N messages', () => {
    const result = paginate(msgs, { limit: 3 });
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].seq).toBe(7);
    expect(result.messages[2].seq).toBe(9);
    expect(result.pageInfo.hasPreviousPage).toBe(true);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  it('no cursor, limit >= total → all, no previous', () => {
    const result = paginate(msgs, { limit: 100 });
    expect(result.messages).toHaveLength(10);
    expect(result.pageInfo.hasPreviousPage).toBe(false);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  // --- before cursor ---
  it('before → returns last N before that point', () => {
    const cursor = encodeCursor(msgs[7].timestamp, 7);
    const result = paginate(msgs, { limit: 3, before: cursor });
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].seq).toBe(4);
    expect(result.messages[2].seq).toBe(6);
    expect(result.pageInfo.hasPreviousPage).toBe(true);
    expect(result.pageInfo.hasNextPage).toBe(true);
  });

  it('before → cursor near start, fewer than limit', () => {
    const cursor = encodeCursor(msgs[2].timestamp, 2);
    const result = paginate(msgs, { limit: 10, before: cursor });
    expect(result.messages).toHaveLength(2); // seq 0, 1
    expect(result.pageInfo.hasPreviousPage).toBe(false);
    expect(result.pageInfo.hasNextPage).toBe(true);
  });

  it('before → cursor at first message, empty result', () => {
    const cursor = encodeCursor(msgs[0].timestamp, 0);
    const result = paginate(msgs, { limit: 10, before: cursor });
    expect(result.messages).toHaveLength(0);
    expect(result.pageInfo.startCursor).toBeNull();
    expect(result.pageInfo.endCursor).toBeNull();
    expect(result.pageInfo.hasPreviousPage).toBe(false);
    expect(result.pageInfo.hasNextPage).toBe(true);
  });

  // --- after cursor ---
  it('after → returns first N after that point', () => {
    const cursor = encodeCursor(msgs[2].timestamp, 2);
    const result = paginate(msgs, { limit: 3, after: cursor });
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].seq).toBe(3);
    expect(result.messages[2].seq).toBe(5);
    expect(result.pageInfo.hasPreviousPage).toBe(true);
    expect(result.pageInfo.hasNextPage).toBe(true);
  });

  it('after → cursor near end, fewer than limit', () => {
    const cursor = encodeCursor(msgs[8].timestamp, 8);
    const result = paginate(msgs, { limit: 10, after: cursor });
    expect(result.messages).toHaveLength(1); // seq 9
    expect(result.pageInfo.hasPreviousPage).toBe(true);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  it('after → cursor at last message, empty result', () => {
    const cursor = encodeCursor(msgs[9].timestamp, 9);
    const result = paginate(msgs, { limit: 10, after: cursor });
    expect(result.messages).toHaveLength(0);
    expect(result.pageInfo.hasPreviousPage).toBe(true);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  // --- Same timestamp, different seq ---
  it('same ts different seq: before excludes exact match', () => {
    const sameTs = [
      { timestamp: '2026-03-06T12:00:00.000Z', seq: 0, role: 'user' as const, content: 'a', contentTruncated: false },
      { timestamp: '2026-03-06T12:00:00.000Z', seq: 1, role: 'user' as const, content: 'b', contentTruncated: false },
      { timestamp: '2026-03-06T12:00:00.000Z', seq: 2, role: 'user' as const, content: 'c', contentTruncated: false },
    ];
    const cursor = encodeCursor('2026-03-06T12:00:00.000Z', 2);
    const result = paginate(sameTs, { limit: 10, before: cursor });
    expect(result.messages).toHaveLength(2); // seq 0, 1
    expect(result.messages.map((m) => m.seq)).toEqual([0, 1]);
  });

  // --- Mutual exclusion ---
  it('before + after → throws BAD_USER_INPUT', () => {
    const c1 = encodeCursor(msgs[2].timestamp, 2);
    const c2 = encodeCursor(msgs[5].timestamp, 5);
    expect(() => paginate(msgs, { limit: 3, before: c1, after: c2 })).toThrow('Cannot specify both');
  });

  // --- Empty array ---
  it('empty messages → empty result', () => {
    const result = paginate([], { limit: 10 });
    expect(result.messages).toHaveLength(0);
    expect(result.pageInfo.startCursor).toBeNull();
    expect(result.pageInfo.endCursor).toBeNull();
    expect(result.pageInfo.hasPreviousPage).toBe(false);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  // --- Invalid cursor ---
  it('invalid cursor → throws', () => {
    expect(() => paginate(msgs, { limit: 3, before: 'garbage' })).toThrow();
  });
});
