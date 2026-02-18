import type { Channel } from '@claw-insights/shared';
import { formatLatency, channelShortName } from '../../utils/format';

interface ChannelPillsProps {
  channels: Channel[];
  fetching: boolean;
}

export function ChannelPills({ channels, fetching }: ChannelPillsProps) {
  if (fetching) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-edge">
        <span className="w-1 h-1 rounded-full animate-pulse bg-fg-dim" />
        <span className="inline-block w-12 h-3 rounded animate-pulse bg-skeleton" />
      </div>
    );
  }

  return (
    <>
      {channels.map((c) => (
        <div key={c.name} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-edge">
          <span className={`w-1 h-1 rounded-full ${c.connected ? 'bg-emerald' : 'bg-red'}`} />
          <span className="text-[11px] text-fg-muted">{channelShortName(c.name)}</span>
          {c.latencyMs != null && <span className="text-[10px] mono text-fg-dim">{formatLatency(c.latencyMs)}</span>}
        </div>
      ))}
    </>
  );
}
