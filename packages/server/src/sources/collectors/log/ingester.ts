import type { LogEntry } from '@claw-insights/shared';

import type { Database } from '../../../db/database.js';
import { insertEvent } from '../../../db/event-queries.js';
import { createChildLogger } from '../../../logger.js';

const log = createChildLogger('log-ingester');

export function createLogIngester(db: Database) {
  let ingestCount = 0;

  return function ingestLog(entry: LogEntry): void {
    try {
      const msg = entry.message;
      if (entry.level === 'ERROR') {
        insertEvent(db, 'error', null, { module: entry.module, message: msg });
      }
      if (entry.level === 'WARN') {
        insertEvent(db, 'warning', null, { module: entry.module, message: msg });
      }
      if (msg.includes('tool start')) {
        insertEvent(db, 'tool_call', 1, { module: entry.module });
      }
      if (msg.includes('embedded run tool start')) {
        insertEvent(db, 'api_call', 1, { module: entry.module });
      }
      if (msg.includes('gateway restart')) {
        insertEvent(db, 'gateway_restart', null, {});
      }
      ingestCount++;
      if (ingestCount % 100 === 0) {
        log.debug({ count: ingestCount }, 'batch ingested');
      }
    } catch (err) {
      log.warn({ err }, 'log entry parse/ingest failed');
    }
  };
}
