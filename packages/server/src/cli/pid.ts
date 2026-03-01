import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('cli:pid');

export class PidFile {
  constructor(private readonly path: string) {}

  write(pid: number): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.path, String(pid), { flag: 'wx' });
    log.debug({ pid, path: this.path }, 'PID file written');
  }

  read(): number | null {
    if (!existsSync(this.path)) {
      return null;
    }
    const content = readFileSync(this.path, 'utf-8').trim();
    const pid = parseInt(content, 10);
    if (!Number.isFinite(pid) || pid <= 0) {
      log.warn({ content, path: this.path }, 'invalid PID file content');
      return null;
    }
    log.debug({ pid, path: this.path }, 'PID file read');
    return pid;
  }

  remove(): void {
    if (existsSync(this.path)) {
      unlinkSync(this.path);
      log.debug({ path: this.path }, 'PID file removed');
    }
  }

  isAlive(): boolean {
    const pid = this.read();
    if (pid === null) {
      return false;
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /** Remove PID file if the recorded process is not running */
  cleanStale(): void {
    if (this.read() !== null && !this.isAlive()) {
      this.remove();
    }
  }
}
