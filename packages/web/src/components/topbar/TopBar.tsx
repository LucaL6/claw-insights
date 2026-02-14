import { useQuery } from 'urql';
import { GatewayQuery, ResourcesQuery, ChannelsQuery } from '../../graphql/queries';

export function TopBar({ onAction }: { onAction?: (action: 'restart' | 'doctor' | 'update') => void }) {
  const [gw] = useQuery({ query: GatewayQuery, requestPolicy: 'cache-and-network', pollInterval: 10_000 });
  const [res] = useQuery({ query: ResourcesQuery, requestPolicy: 'cache-and-network', pollInterval: 10_000 });
  const [ch] = useQuery({ query: ChannelsQuery, requestPolicy: 'cache-and-network', pollInterval: 10_000 });

  const gateway = gw.data?.gateway;
  const resources = res.data?.resources;
  const channels = ch.data?.channels ?? [];

  return (
    <div className="flex items-center justify-between text-xs">
      {/* Left: Logo + Version + Status */}
      <div className="flex items-center gap-3">
        <span className="text-base">🦞</span>
        <span className="font-mono font-bold text-zinc-200">OpenClaw</span>
        <span className="font-mono text-zinc-500">{gateway?.version ?? '...'}</span>
        {gateway?.running ? (
          <span className="px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 text-[10px] font-bold">UP</span>
        ) : (
          <span className="px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 text-[10px] font-bold">DOWN</span>
        )}
        {gateway?.updateAvailable && (
          <span className="text-amber-500 text-[10px]">↑ {gateway.updateAvailable}</span>
        )}
      </div>

      {/* Center: Channels */}
      <div className="flex items-center gap-4">
        {channels.map((c: { name: string; connected: boolean; latencyMs: number | null }) => (
          <div key={c.name} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${c.connected ? 'bg-emerald-400' : 'bg-red-500'}`} />
            <span className="text-zinc-400">{c.name}</span>
            {c.latencyMs !== null && (
              <span className="text-zinc-600 text-[10px]">{c.latencyMs}ms</span>
            )}
          </div>
        ))}
      </div>

      {/* Right: Resources + Actions */}
      <div className="flex items-center gap-3">
        {resources && (
          <div className="flex items-center gap-3 text-zinc-500 font-mono">
            <span>CPU <span className="text-zinc-300">{resources.cpu.toFixed(1)}%</span></span>
            <span>MEM <span className="text-zinc-300">{resources.memoryMB}MB</span></span>
            <span>DISK <span className="text-zinc-300">{resources.diskMB}MB</span></span>
          </div>
        )}
        <span className="text-zinc-800">|</span>
        <button onClick={() => onAction?.('restart')}
          className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:border-amber-700 hover:text-amber-400 text-[10px]">
          Restart
        </button>
        <button onClick={() => onAction?.('doctor')}
          className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:border-cyan-700 hover:text-cyan-400 text-[10px]">
          Doctor
        </button>
        {gateway?.updateAvailable && (
          <button onClick={() => onAction?.('update')}
            className="px-2 py-0.5 rounded border border-emerald-800 text-emerald-400 text-[10px]">
            ↓ {gateway.updateAvailable}
          </button>
        )}
      </div>
    </div>
  );
}
