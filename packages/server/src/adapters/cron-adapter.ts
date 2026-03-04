// src/adapters/cron-adapter.ts
import type { CronJob } from '@claw-insights/shared';

import type { CronEntry, CronPort } from '../ports/cron-port.js';
import { mapInfraError } from '../ports/error-mapping.js';
import type { ReadContext, Unsubscribe } from '../ports/shared.js';
import type { CronReader } from '../sources/readers/cron-reader.js';
import { createSubscriptionHub } from './shared/subscription-hub.js';

const SOURCE = 'cron-adapter';

function mapToCronEntry(job: CronJob): CronEntry {
  return {
    id: job.id,
    schedule: job.schedule,
    enabled: job.enabled,
    lastRun: job.lastRunAt ? new Date(job.lastRunAt).getTime() : null,
    nextRun: job.nextRunAt ? new Date(job.nextRunAt).getTime() : null,
    description: job.name ?? undefined,
  };
}

export function createCronAdapter(reader: CronReader): CronPort & { destroy: () => void } {
  const hub = createSubscriptionHub();
  let underlyingAttached = false;
  let readerUnsub: (() => void) | null = null;

  function ensureAttached(): void {
    if (underlyingAttached) {
      return;
    }
    readerUnsub = reader.onChange(() => hub.trigger());
    underlyingAttached = true;
  }

  function getCronJobs(_context?: ReadContext): CronEntry[] {
    try {
      return reader.getJobs().map(mapToCronEntry);
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function getCronJobById(id: string, _context?: ReadContext): CronEntry | null {
    try {
      const job = reader.getJobs().find((j) => j.id === id);
      return job ? mapToCronEntry(job) : null;
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function onChanged(callback: () => void): Unsubscribe {
    ensureAttached();
    return hub.subscribe(callback);
  }

  function destroy(): void {
    if (readerUnsub) {
      readerUnsub();
      readerUnsub = null;
    }
    hub.destroy();
  }

  return { getCronJobs, getCronJobById, onChanged, destroy };
}
