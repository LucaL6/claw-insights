import type { SessionTranscriptMessage } from '../../hooks/useSessionTranscript';

export interface TranscriptAnchor {
  index: number;
  id?: string;
}

function compactContent(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function buildTranscriptAnchorId(message: SessionTranscriptMessage): string {
  return `${message.timestamp}|${message.role}|${compactContent(message.content)}`;
}

export function resolveAnchorIndex(
  anchor: TranscriptAnchor | undefined,
  messages: SessionTranscriptMessage[],
): number | undefined {
  if (!anchor || messages.length === 0) {
    return undefined;
  }

  if (anchor.id) {
    const byId = messages.findIndex((message) => buildTranscriptAnchorId(message) === anchor.id);
    if (byId >= 0) {
      return byId;
    }
  }

  if (anchor.index < 0) {
    return 0;
  }

  if (anchor.index >= messages.length) {
    return messages.length - 1;
  }

  return anchor.index;
}
