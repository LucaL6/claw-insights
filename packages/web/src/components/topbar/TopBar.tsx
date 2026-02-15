import { GatewayQuery, ResourcesQuery, ChannelsQuery, MetricsQuery } from '../../graphql/queries';
import { useReactiveQuery } from '../../hooks/useReactiveQuery';

function formatUptime(startedAt: string | null | undefined): string {
  if (!startedAt) return '';
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return '';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return '';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function channelShortName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('telegram')) return 'TG';
  if (lower.includes('slack')) return 'Slack';
  if (lower.includes('discord')) return 'Discord';
  if (lower.includes('signal')) return 'Signal';
  if (lower.includes('whatsapp')) return 'WA';
  if (lower.includes('webchat')) return 'Web';
  return name.slice(0, 6);
}

export function TopBar({ onAction }: { onAction?: (action: 'restart' | 'doctor' | 'update') => void }) {
  const [gw] = useReactiveQuery(
    { query: GatewayQuery, requestPolicy: 'cache-and-network' },
    { sources: ['gateway'] },
  );
  const [res] = useReactiveQuery(
    { query: ResourcesQuery, requestPolicy: 'cache-and-network' },
    { sources: ['gateway', 'metrics'] },
  );
  const [ch] = useReactiveQuery(
    { query: ChannelsQuery, requestPolicy: 'cache-and-network' },
    { sources: ['gateway'] },
  );
  const [met] = useReactiveQuery(
    { query: MetricsQuery, requestPolicy: 'cache-and-network' },
    { sources: ['metrics'] },
  );

  const gateway = gw.data?.gateway;
  const resources = res.data?.resources;
  const channels = (ch.data?.channels ?? []) as Array<{ name: string; connected: boolean; latencyMs: number | null; provider: string }>;
  const metrics = met.data?.metrics as { totalTokensK: number; totalErrors: number; totalWarnings: number } | undefined;

  const uptime = formatUptime(gateway?.startedAt);
  const version = gateway?.version ?? '...';
  const latestVersion = gateway?.latestVersion as string | null;
  // Show short diff like ".13" if both versions share prefix
  const updateLabel = latestVersion
    ? (latestVersion.startsWith(version.slice(0, -2)) ? '.' + latestVersion.split('.').pop() : latestVersion)
    : null;

  return (
    <div className="flex items-center justify-between text-xs">
      {/* Left: Logo + Version + Status + Channels */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🦞</span>
          <span className="text-sm font-semibold tracking-tight">OpenClaw</span>
          <span className="text-[10px] text-zinc-500 mono">{version}</span>
        </div>

        {/* UP/DOWN badge */}
        {gateway?.running ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full pulse-dot" />
            <span className="text-[11px] text-emerald-400 font-medium">UP</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
            <span className="text-[11px] text-red-400 font-medium">DOWN</span>
          </div>
        )}

        {/* Channels with latency */}
        {channels.map((c) => (
          <div key={c.name} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900/60 border border-zinc-800 rounded-md">
            <span className={`w-1 h-1 rounded-full ${c.connected ? 'bg-emerald-400' : 'bg-red-500'}`} />
            <span className="text-[11px] text-zinc-400">{channelShortName(c.name)}</span>
            {c.latencyMs !== null && (
              <span className="text-[10px] text-zinc-600 mono">{formatLatency(c.latencyMs)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Center: Resources + Token/Err/Warn */}
      <div className="flex items-center gap-3 text-[10px]">
        <div className="flex items-center gap-3 px-3 py-1 bg-zinc-900/40 border border-zinc-800/60 rounded-md">
          {resources && (
            <>
              <span className="text-zinc-500">CPU</span>
              <span className="mono text-zinc-300">{resources.cpu.toFixed(1)}%</span>
              <span className="w-px h-3 bg-zinc-800" />
              <span className="text-zinc-500">MEM</span>
              <span className="mono text-zinc-300">{resources.memoryMB}M</span>
            </>
          )}
          {metrics && (
            <>
              <span className="w-px h-3 bg-zinc-800" />
              <span className="text-zinc-500">Token</span>
              <span className="mono text-zinc-200 font-medium">{metrics.totalTokensK > 0 ? `${Math.round(metrics.totalTokensK)}k` : '0'}</span>
              <span className="w-px h-3 bg-zinc-800" />
              <span className="text-zinc-500">Err</span>
              <span className="mono text-red-400">{metrics.totalErrors}</span>
              <span className="text-zinc-500">Warn</span>
              <span className="mono text-yellow-400">{metrics.totalWarnings}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions + Update + Uptime */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onAction?.('restart')}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700 rounded-md transition-all"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Restart
        </button>
        <button
          onClick={() => onAction?.('doctor')}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700 rounded-md transition-all"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          Doctor
        </button>

        {/* Update button — always visible when update available, orange */}
        {updateLabel && (
          <button
            onClick={() => onAction?.('update')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-md transition-all"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {updateLabel}
          </button>
        )}

        {/* Divider + Uptime */}
        {uptime && (
          <>
            <div className="w-px h-4 bg-zinc-800 mx-0.5" />
            <span className="text-[10px] text-zinc-500 mono">⏱ {uptime}</span>
          </>
        )}
      </div>
    </div>
  );
}
