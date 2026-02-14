import { useQuery } from 'urql';
import { MetricsQuery } from '../../graphql/queries';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { SessionsChart } from './SessionsChart';
import { TokensChart } from './TokensChart';
import { CallsChart } from './CallsChart';
import { ErrorsChart } from './ErrorsChart';
import { UptimeStrip } from './UptimeStrip';

export function MetricsSection() {
  const [result] = useQuery({
    query: MetricsQuery,
    requestPolicy: 'cache-and-network',
  });

  const metrics = result.data?.metrics;
  const hours = metrics?.hours ?? [];

  const totalSessions = hours.reduce((s: number, h: { sessions: number }) => s + h.sessions, 0);
  const totalTokensK = metrics?.totalTokensK ?? 0;
  const totalApi = hours.reduce((s: number, h: { apiCalls: number }) => s + h.apiCalls, 0);
  const totalTool = hours.reduce((s: number, h: { toolCalls: number }) => s + h.toolCalls, 0);
  const totalErrors = metrics?.totalErrors ?? 0;
  const uptimePct = metrics?.uptimePercent ?? 0;

  return (
    <CollapsibleSection title="Metrics (24h)">
      {/* Summary row */}
      {metrics && (
        <div className="flex gap-4 mb-3 text-xs">
          <span className="text-zinc-500">Tokens: <span className="text-emerald-400">{metrics.totalTokensK.toFixed(1)}k</span></span>
          <span className="text-zinc-500">Errors: <span className="text-red-400">{metrics.totalErrors}</span></span>
          <span className="text-zinc-500">Warnings: <span className="text-amber-400">{metrics.totalWarnings}</span></span>
          <span className="text-zinc-500">Uptime: <span className="text-emerald-400">{metrics.uptimePercent.toFixed(1)}%</span></span>
        </div>
      )}

      {/* 2×2 chart grid + uptime strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 h-40 relative">
          <div className="absolute top-2 left-3 text-[10px] text-zinc-500 z-10">
            Active Sessions <span className="text-emerald-400 font-bold">{totalSessions}</span>
          </div>
          <SessionsChart data={hours} />
        </div>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 h-40 relative">
          <div className="absolute top-2 left-3 text-[10px] text-zinc-500 z-10">
            Token Consumption <span className="text-emerald-400 font-bold">{totalTokensK.toFixed(0)}k total</span>
          </div>
          <TokensChart data={hours} />
        </div>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 h-40 relative">
          <div className="absolute top-2 left-3 text-[10px] text-zinc-500 z-10">
            API / Tool Calls <span className="text-cyan-400">{totalApi} api</span> <span className="text-amber-400">{totalTool} tool</span>
          </div>
          <CallsChart data={hours} />
        </div>
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 h-40 relative">
          <div className="absolute top-2 left-3 text-[10px] text-zinc-500 z-10">
            Gateway Errors <span className="text-red-400 font-bold">{totalErrors} today</span>
          </div>
          <ErrorsChart data={hours} />
        </div>
      </div>

      {/* Uptime strip with legend */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 h-12 mt-3 relative">
        <div className="absolute top-1 left-3 text-[10px] text-zinc-500 z-10 flex items-center gap-3">
          Gateway Uptime
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-sm" />up</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm" />down</span>
        </div>
        <div className="absolute top-1 right-3 text-[10px] text-emerald-400 font-bold z-10">
          {uptimePct.toFixed(1)}%
        </div>
        <UptimeStrip data={hours} />
      </div>
    </CollapsibleSection>
  );
}
