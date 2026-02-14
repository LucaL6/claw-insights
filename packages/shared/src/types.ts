/** Session status */
export type SessionStatus = 'ACTIVE' | 'IDLE' | 'DONE' | 'FAILED';

/** Log level */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/** Gateway status */
export interface GatewayStatus {
  running: boolean;
  pid: number | null;
  version: string;
  updateAvailable: string | null;
  uptime: string;
  cpu: number;
  memoryMB: number;
}

/** Channel connectivity */
export interface Channel {
  name: string;
  connected: boolean;
  latencyMs: number | null;
}

/** Session */
export interface Session {
  key: string;
  displayName: string;
  kind: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  contextTokens: number;
  usagePercent: number;
  status: SessionStatus;
  updatedAt: number;
  subAgents: SubAgent[];
}

/** Sub-agent */
export interface SubAgent {
  key: string;
  label: string;
  status: SessionStatus;
  totalTokens: number;
  updatedAt: number;
}

/** Log entry */
export interface LogEntry {
  time: string;
  level: LogLevel;
  module: string;
  message: string;
}

/** Hourly metrics */
export interface HourlyMetrics {
  hour: number;
  sessions: number;
  tokensK: number;
  apiCalls: number;
  toolCalls: number;
  errors: number;
  warnings: number;
  gatewayUp: boolean;
  restartEvent: boolean;
}

/** Metrics summary */
export interface MetricsSummary {
  hours: HourlyMetrics[];
  totalTokensK: number;
  totalErrors: number;
  totalWarnings: number;
  uptimePercent: number;
}

/** Cron job */
export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
  lastStatus: 'success' | 'failed' | null;
  nextRun: string | null;
}
