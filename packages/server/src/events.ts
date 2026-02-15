import { EventEmitter } from 'events';

export type DataSource = 'sessions' | 'metrics' | 'gateway';

export interface DataChangeEvent {
  source: DataSource;
  ts: string;
}

export const dataBus = new EventEmitter();
dataBus.setMaxListeners(50); // multiple SSE clients

export function emitChange(source: DataSource): void {
  dataBus.emit('change', { source, ts: new Date().toISOString() } satisfies DataChangeEvent);
}
