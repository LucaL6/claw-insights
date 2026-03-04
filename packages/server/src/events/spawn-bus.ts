// src/events/spawn-bus.ts
import { EventEmitter } from 'node:events';

export interface SpawnLinkEvent {
  parent: string;
  child: string;
}

export class SpawnBus extends EventEmitter {
  emitLink(event: SpawnLinkEvent): void {
    this.emit('spawn:link', event);
  }

  onLink(handler: (event: SpawnLinkEvent) => void): () => void {
    this.on('spawn:link', handler);
    return () => this.off('spawn:link', handler);
  }
}

export const createSpawnBus = (): SpawnBus => new SpawnBus();
