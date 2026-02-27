// ── From system-info.ts ─────────────────────────────────────────

export function parseLaunchctlOutput(stdout: string): number | null {
  const line = stdout.split('\n').find((l) => l.includes('ai.openclaw.gateway'));
  if (!line) {
    return null;
  }
  const match = line.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function parsePsOutput(stdout: string): { cpu: number; memoryMB: number } | null {
  const trimmed = stdout.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    return null;
  }
  const rssKB = parseInt(parts[0], 10);
  const cpu = parseFloat(parts[1]);
  if (isNaN(rssKB) || isNaN(cpu)) {
    return null;
  }
  return { cpu, memoryMB: Math.round(rssKB / 1024) };
}

export function parseDuOutput(stdout: string): number {
  const match = stdout.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export interface UsageCost {
  totalCost: number;
  totalTokensM: number;
  todayCost: number;
  todayTokensM: number;
  fetchedAt: string;
}

export function parseUsageCostOutput(output: string): UsageCost {
  const result: UsageCost = {
    totalCost: 0,
    totalTokensM: 0,
    todayCost: 0,
    todayTokensM: 0,
    fetchedAt: new Date().toISOString(),
  };

  const totalMatch = output.match(/Total:\s*\$([\d.]+)\s*·\s*([\d.]+)m\s*tokens/i);
  if (totalMatch) {
    result.totalCost = parseFloat(totalMatch[1]);
    result.totalTokensM = parseFloat(totalMatch[2]);
  }

  const todayMatch = output.match(/Latest day:.*?\$([\d.]+)\s*·\s*([\d.]+)m\s*tokens/i);
  if (todayMatch) {
    result.todayCost = parseFloat(todayMatch[1]);
    result.todayTokensM = parseFloat(todayMatch[2]);
  }

  return result;
}

// ── From gateway-cli.ts ─────────────────────────────────────────

export interface ChannelInfo {
  provider: string;
  name: string;
  connected: boolean;
  latencyMs: number | null;
}

export function parseChannels(summary: string[]): ChannelInfo[] {
  const channels: ChannelInfo[] = [];
  for (const line of summary) {
    const match = line.match(/^(\w+):\s*(\w+)/);
    if (match) {
      channels.push({
        provider: match[1].toLowerCase(),
        name: match[1],
        connected: match[2] === 'configured' || match[2] === 'connected',
        latencyMs: null,
      });
    }
  }
  return channels;
}

export function formatUptime(etimeStr: string): string {
  const parts = etimeStr.trim().replace(/-/g, ':').split(':').map(Number);
  let secs = 0;
  if (parts.length === 4) {
    secs = parts[0] * 86400 + parts[1] * 3600 + parts[2] * 60 + parts[3];
  } else if (parts.length === 3) {
    secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    secs = parts[0] * 60 + parts[1];
  }

  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) {
    return `${d}d ${h}h`;
  }
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}
