export const mockGateway = {
  running: true,
  pid: 65471,
  version: '2026.2.12',
  updateAvailable: '2026.2.13',
  uptime: '3d 12h',
  startedAt: '2026-02-12T02:30:00Z',
};

export const mockResources = {
  cpu: 2.4,
  memoryMB: 187,
  diskMB: 342,
  sampledAt: new Date().toISOString(),
};

export const mockChannels = [
  { provider: 'webchat', name: 'WebChat', connected: true, latencyMs: 12 },
  { provider: 'slack', name: 'Slack', connected: true, latencyMs: 45 },
  { provider: 'telegram', name: 'Telegram', connected: true, latencyMs: 89 },
  { provider: 'discord', name: 'Discord', connected: false, latencyMs: null },
];

export const mockSessions = [
  {
    key: 'agent:main:research-ui-skill',
    displayName: 'research-ui-skill',
    kind: 'direct',
    model: 'claude-opus-4-6',
    channel: 'webchat',
    totalTokens: 51200,
    contextTokens: 200000,
    usagePercent: 25.6,
    status: 'ACTIVE',
    updatedAt: Date.now(),
    subAgents: [
      { key: 'agent:main:design-review-001', label: 'design-review-001', status: 'DONE', totalTokens: 12800, updatedAt: Date.now() - 60000 },
      { key: 'agent:main:code-review-002', label: 'code-review-002', status: 'ACTIVE', totalTokens: 8400, updatedAt: Date.now() - 5000 },
    ],
  },
  {
    key: 'agent:main:openclaw-tui',
    displayName: 'openclaw-tui',
    kind: 'direct',
    model: 'claude-opus-4-6',
    channel: 'webchat',
    totalTokens: 34500,
    contextTokens: 200000,
    usagePercent: 17.3,
    status: 'ACTIVE',
    updatedAt: Date.now() - 30000,
    subAgents: [],
  },
  {
    key: 'cron:hn-digest',
    displayName: 'HN Digest',
    kind: 'cron',
    model: 'claude-sonnet-4-20250514',
    channel: null,
    totalTokens: 5200,
    contextTokens: 200000,
    usagePercent: 2.6,
    status: 'IDLE',
    updatedAt: Date.now() - 3600000,
    subAgents: [],
  },
];

export const mockCronJobs = [
  { id: 'hn-digest', name: 'HN Digest', enabled: true, schedule: '0 9 * * MON-FRI', lastRunAt: '2026-02-14T09:00:00Z', lastRunSuccess: true, nextRunAt: '2026-02-17T09:00:00Z' },
  { id: 'heartbeat', name: 'Heartbeat', enabled: true, schedule: 'every 30m', lastRunAt: '2026-02-15T00:00:00Z', lastRunSuccess: true, nextRunAt: '2026-02-15T00:30:00Z' },
];

function generateHourlyMetrics(): Array<Record<string, unknown>> {
  const currentHour = new Date().getHours();
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    sessions: hour <= currentHour ? Math.floor(Math.random() * 8) + 1 : 0,
    tokensK: hour <= currentHour ? Math.round(Math.random() * 50 * 10) / 10 : 0,
    apiCalls: hour <= currentHour ? Math.floor(Math.random() * 30) : 0,
    toolCalls: hour <= currentHour ? Math.floor(Math.random() * 45) : 0,
    errors: hour <= currentHour ? Math.floor(Math.random() * 3) : 0,
    warnings: hour <= currentHour ? Math.floor(Math.random() * 8) : 0,
    gatewayUp: true,
    restartEvent: hour === 4,
  }));
}

export function getMockMetrics() {
  const hours = generateHourlyMetrics();
  return {
    date: new Date().toISOString().split('T')[0],
    hours,
    totalTokensK: hours.reduce((s, h) => s + (h.tokensK as number), 0),
    totalErrors: hours.reduce((s, h) => s + (h.errors as number), 0),
    totalWarnings: hours.reduce((s, h) => s + (h.warnings as number), 0),
    uptimePercent: 99.6,
  };
}

const LOG_MODULES = ['agent/embedded', 'diagnostic', 'cron', 'plugins', 'tools', 'sessions'];
const LOG_LEVELS: Array<'DEBUG' | 'INFO' | 'WARN' | 'ERROR'> = ['INFO', 'INFO', 'INFO', 'DEBUG', 'WARN', 'ERROR'];

export function generateMockLog() {
  const level = LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)];
  const module = LOG_MODULES[Math.floor(Math.random() * LOG_MODULES.length)];
  const messages: Record<string, string[]> = {
    INFO: ['run start', 'run completed', 'tool completed: exec', 'session activated'],
    DEBUG: ['cache hit', 'polling channels', 'heartbeat ack'],
    WARN: ['MEMORY.md truncating context', 'rate limit approaching'],
    ERROR: ['exec failed: timeout', 'RPC connection lost'],
  };
  const msgs = messages[level];
  const message = msgs[Math.floor(Math.random() * msgs.length)];
  return {
    time: new Date().toISOString().split('T')[1].slice(0, 12),
    level,
    module,
    message,
  };
}
