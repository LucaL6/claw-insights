import type { CronJob } from '@claw-insights/shared';
import { type FSWatcher,readFileSync, watch } from 'fs';

import { config } from '../../config.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('cron-reader');

interface RawJob {
  id: string;
  name?: string;
  enabled: boolean;
  schedule: { kind: string; expr?: string; at?: string; everyMs?: number };
  state?: { lastRunAtMs?: number; lastStatus?: string; lastDurationMs?: number };
}

interface RawCronFile {
  version: number;
  jobs: RawJob[];
}

const CRON_PATH = config.cronPath;

function formatSchedule(s: RawJob['schedule']): string {
  if (s.kind === 'cron' && s.expr) {return s.expr;}
  if (s.kind === 'at' && s.at) {return `at ${s.at}`;}
  if (s.kind === 'every' && s.everyMs) {return `every ${Math.round(s.everyMs / 60000)}m`;}
  return s.kind;
}

function parseJob(raw: RawJob): CronJob {
  return {
    id: raw.id,
    name: raw.name ?? null,
    enabled: raw.enabled,
    schedule: formatSchedule(raw.schedule),
    lastRunAt: raw.state?.lastRunAtMs ? new Date(raw.state.lastRunAtMs).toISOString() : null,
    lastRunSuccess: raw.state?.lastStatus === 'ok' ? true : raw.state?.lastStatus ? false : null,
    nextRunAt: null, // Would need schedule parsing to compute
  };
}

export class CronReader {
  private jobs: CronJob[] = [];
  private watcher: FSWatcher | null = null;
  private listeners: Array<() => void> = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private filePath: string = CRON_PATH) {
    this.reload();
    this.startWatching();
  }

  private reload() {
    try {
      const data = JSON.parse(readFileSync(this.filePath, 'utf-8')) as RawCronFile;
      this.jobs = data.jobs.map(parseJob);
    } catch (err) {
      log.error({ err }, 'failed to read cron jobs');
    }
  }

  private startWatching() {
    try {
      this.watcher = watch(this.filePath, () => {
        if (this.debounceTimer) {clearTimeout(this.debounceTimer);}
        this.debounceTimer = setTimeout(() => {
          this.reload();
          for (const fn of this.listeners) {fn();}
        }, 300);
      });
    } catch {
      /* file might not exist */
    }
  }

  getJobs(): CronJob[] {
    return this.jobs;
  }

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  destroy() {
    this.watcher?.close();
    if (this.debounceTimer) {clearTimeout(this.debounceTimer);}
    this.listeners = [];
  }
}
