import { createChildLogger } from '../logger.js';

const log = createChildLogger('message-event-bus');

export interface MessageEvent {
  timestamp: string;
  sessionKey: string;
  role: string;
}

export type MessageEventHandler = (event: MessageEvent) => void;

export class MessageEventBus {
  private handlers: MessageEventHandler[] = [];

  on(handler: MessageEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: MessageEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        log.warn({ err }, 'MessageEventBus handler error');
      }
    }
  }

  destroy(): void {
    this.handlers = [];
  }
}
