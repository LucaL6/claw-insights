import { describe, expect, it } from 'vitest';

import type { SessionTranscriptMessage } from '../../../hooks/useSessionTranscript';
import { buildTranscriptAnchorId, resolveAnchorIndex } from '../transcriptAnchor';

function makeMessage(
  timestamp: string,
  role: SessionTranscriptMessage['role'],
  content: string,
): SessionTranscriptMessage {
  return {
    timestamp,
    role,
    content,
    contentTruncated: false,
    model: undefined,
    usage: undefined,
    toolName: undefined,
  };
}

describe('transcriptAnchor', () => {
  it('builds stable anchor id from timestamp role and compacted content', () => {
    const id = buildTranscriptAnchorId(makeMessage('2026-03-04T01:00:00Z', 'assistant', 'hello   world\n\nagain'));
    expect(id).toContain('2026-03-04T01:00:00Z|assistant|hello world again');
  });

  it('restores by message id before fallback index', () => {
    const a = makeMessage('t1', 'user', 'A');
    const b = makeMessage('t2', 'assistant', 'B');
    const c = makeMessage('t3', 'assistant', 'C');

    const messages = [makeMessage('tp', 'assistant', 'prepended'), a, b, c];
    const anchor = {
      index: 1,
      id: buildTranscriptAnchorId(b),
    };

    expect(resolveAnchorIndex(anchor, messages)).toBe(2);
  });

  it('falls back to clamped index when id is missing', () => {
    const messages = [makeMessage('t1', 'user', 'A'), makeMessage('t2', 'assistant', 'B')];

    expect(resolveAnchorIndex({ index: 9, id: 'missing' }, messages)).toBe(1);
    expect(resolveAnchorIndex({ index: -3, id: 'missing' }, messages)).toBe(0);
  });
});
