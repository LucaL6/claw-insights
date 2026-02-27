// src/ports/types.ts

export interface ProcessAdapter {
  /** Find the OpenClaw gateway process PID. */
  getPid(): Promise<number | null>;

  /** Get process CPU% and memory in MB. Returns null if process not found. */
  getProcessMetrics(pid: number): Promise<{ cpu: number; memoryMB: number } | null>;

  /** Get formatted process uptime string (e.g. "2h 30m"). */
  getUptime(pid: number): Promise<string>;

  /** Find PID by listening TCP port. Returns null if unsupported or not found. */
  findPidByPort(port: number): Promise<number | null>;

  /** Get directory disk usage in MB. */
  getDiskMB(dir: string): Promise<number>;
}

export interface CliAdapter {
  /** Execute an OpenClaw CLI command and return stdout. Returns '' on failure. */
  exec(argv: string[]): Promise<string>;
}

export interface Platform {
  process: ProcessAdapter;
  cli: CliAdapter;
}
