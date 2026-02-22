import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class PidFile {
  constructor(private readonly path: string) {}

  write(pid: number): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.path, String(pid), { flag: 'wx' });
  }

  read(): number | null {
    if (!existsSync(this.path)) return null;
    const content = readFileSync(this.path, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  }

  remove(): void {
    if (existsSync(this.path)) {
      unlinkSync(this.path);
    }
  }

  isAlive(): boolean {
    const pid = this.read();
    if (pid === null) return false;
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
