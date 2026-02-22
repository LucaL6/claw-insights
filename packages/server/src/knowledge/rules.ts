import type { DiagnosticRule } from './types.js';

export const diagnosticRules: DiagnosticRule[] = [
  {
    id: 'high-cpu', severity: 'warning', title: 'High CPU usage',
    detail: `Possible causes:\n- Heavy model inference or tool execution\n- Browser pool running multiple captures\n- Log ingestion backlog\n\nSuggested actions:\n1. Check active sessions for runaway tool loops\n2. Review browser pool concurrency settings\n3. Consider restarting gateway if sustained > 5 minutes`,
    check: (s) => s.cpu > 80,
  },
  {
    id: 'high-memory', severity: 'warning', title: 'Memory usage above 1 GB',
    detail: `Possible causes:\n- Large context windows (>100k tokens per session)\n- Too many concurrent active sessions\n- Browser pool holding open pages\n\nSuggested actions:\n1. Check session token counts in Sessions panel\n2. Review max concurrent sessions configuration\n3. Consider restarting gateway to reclaim memory`,
    check: (s) => s.memoryMB > 1024 && s.memoryMB <= 2048,
  },
  {
    id: 'critical-memory', severity: 'critical', title: 'Memory usage above 2 GB',
    detail: `System may be at risk of OOM. Immediate action recommended:\n1. Restart gateway to reclaim memory\n2. Reduce concurrent session limit\n3. Check for memory leaks in browser pool`,
    check: (s) => s.memoryMB > 2048,
  },
  {
    id: 'disk-space-low', severity: 'warning', title: 'OpenClaw data exceeds 500 MB',
    detail: `Log and database files may be growing unchecked.\n\nSuggested actions:\n1. Check data retention settings (rawRetentionDays)\n2. Review log directory size\n3. Run manual data retention cleanup`,
    check: (s) => s.diskMB > 500,
  },
  {
    id: 'error-spike', severity: 'warning', title: 'High error rate in last 24 hours',
    detail: `More than 50 errors detected in the last 24 hours.\n\nSuggested actions:\n1. Check Recent Logs for recurring error patterns\n2. Look for failed tool executions or API timeouts\n3. Review gateway configuration for misconfigured channels`,
    check: (s) => s.errorsLast24h > 50 && s.errorsLast24h <= 200,
  },
  {
    id: 'critical-errors', severity: 'critical', title: 'Error storm — over 200 errors in 24 hours',
    detail: `This suggests a systemic issue, not just intermittent failures.\n\nSuggested actions:\n1. Check if a specific module is producing all errors\n2. Verify API keys and service connectivity\n3. Consider disabling problematic channels temporarily`,
    check: (s) => s.errorsLast24h > 200,
  },
  {
    id: 'gateway-down', severity: 'critical', title: 'Gateway is not running',
    detail: `The OpenClaw gateway process is not detected.\n\nSuggested actions:\n1. Run: openclaw gateway start\n2. Check system logs for crash information\n3. Verify launchctl service registration`,
    check: (s) => s.gatewayRunning === false,
  },
  {
    id: 'gateway-status-unknown', severity: 'info', title: 'Gateway status unavailable',
    detail: `Could not determine whether the gateway is running (CLI error or timeout).\n\nSuggested actions:\n1. Check if openclaw CLI is accessible\n2. Verify launchctl service registration\n3. Try running: openclaw gateway status`,
    check: (s) => s.gatewayRunning === null,
  },
  {
    id: 'frequent-restarts', severity: 'warning', title: 'Gateway restarted multiple times recently',
    detail: `3 or more gateway restarts in the last 24 hours may indicate instability.\n\nSuggested actions:\n1. Check logs around restart timestamps\n2. Look for OOM kills or crash patterns\n3. Review recent configuration changes`,
    check: (s) => s.recentRestarts >= 3,
  },
  {
    id: 'cost-spike', severity: 'warning', title: 'Daily cost exceeds $5',
    detail: `Today's API spending is elevated.\n\nSuggested actions:\n1. Check which sessions/models are consuming most tokens\n2. Look for tool call loops or excessive retries\n3. Consider switching expensive models to cheaper alternatives`,
    check: (s) => s.costTodayUsd > 5 && s.costTodayUsd <= 20,
  },
  {
    id: 'cost-critical', severity: 'critical', title: 'Daily cost exceeds $20',
    detail: `Spending is significantly above normal. Immediate review recommended.\n\nSuggested actions:\n1. Identify the top token-consuming session\n2. Check for runaway agent loops\n3. Consider pausing non-essential sessions`,
    check: (s) => s.costTodayUsd > 20,
  },
  {
    id: 'no-active-sessions', severity: 'info', title: 'No active sessions',
    detail: `No sessions are currently active. This is normal during idle periods.\n\nIf unexpected:\n1. Check gateway status\n2. Verify channel connections (Telegram, Discord, etc.)\n3. Check session reader file path configuration`,
    check: (s) => s.gatewayRunning === true && s.activeSessions === 0,
  },
  {
    id: 'token-velocity', severity: 'warning', title: 'Token consumption above 1M today',
    detail: `Over 1 million tokens consumed in the current day.\n\nSuggested actions:\n1. Review per-model cost breakdown in Cost panel\n2. Check for sessions with unusually high token counts\n3. Consider rate limiting or model switching for bulk tasks`,
    check: (s) => s.totalTokensK > 1000,
  },
];
