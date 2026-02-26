import { createChildLogger } from '../logger.js';

const log = createChildLogger('token-event-bus');

export interface TokenUsageEvent {
  timestamp: string;
  sessionKey: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type TokenUsageHandler = (event: TokenUsageEvent) => void;

export class TokenEventBus {
  private handlers: TokenUsageHandler[] = [];

  on(handler: TokenUsageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: TokenUsageEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        log.warn({ err }, 'TokenEventBus handler error');
      }
    }
  }

  destroy(): void {
    this.handlers = [];
  }
}
