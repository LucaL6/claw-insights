/** Severity levels for diagnostic findings */
export type DiagnosticSeverity = 'critical' | 'warning' | 'info';

/** Snapshot of system state fed to rule conditions */
export interface SystemSnapshot {
  cpu: number;
  memoryMB: number;
  diskMB: number;
  activeSessions: number;
  totalTokensK: number;
  errorsLast24h: number;
  warningsLast24h: number;
  gatewayRunning: boolean | null; // null = status unknown
  recentRestarts: number;
  costTodayUsd: number;
}

/** A single diagnostic rule */
export interface DiagnosticRule {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  detail: string;
  check: (snapshot: SystemSnapshot) => boolean;
}

/** Result of a matched diagnostic rule */
export interface DiagnosticResult {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  detail: string;
  matchedAt: string;
}
