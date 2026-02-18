import type { LogEntry } from '@claw-insights/shared';
import type { DatabaseSync as Database } from 'node:sqlite';
import { insertEvent } from '../../db/event-queries.js';

export function createLogIngester(db: Database) {
  return function ingestLog(entry: LogEntry): void {
    const msg = entry.message;
    if (entry.level === 'ERROR') insertEvent(db, 'error', null, { module: entry.module, message: msg });
    if (entry.level === 'WARN') insertEvent(db, 'warning', null, { module: entry.module, message: msg });
    if (msg.includes('tool start')) insertEvent(db, 'tool_call', 1, { module: entry.module });
    if (msg.includes('embedded run tool start')) insertEvent(db, 'api_call', 1, { module: entry.module });
    if (msg.includes('gateway restart')) insertEvent(db, 'gateway_restart', null, {});
  };
}
