import { useState, useEffect } from 'react';
import { useQuery } from 'urql';
import { MetricsQuery } from '../../graphql/queries';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { SessionsChart } from './SessionsChart';
import { TokensChart } from './TokensChart';
import { CallsChart } from './CallsChart';
import { ErrorsChart } from './ErrorsChart';
import { UptimeStrip } from './UptimeStrip';
import { useMetricsValidation } from './useMetricsValidation';

export function MetricsSection() {
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  const [result] = useQuery({
    query: MetricsQuery,
    requestPolicy: 'cache-and-network',
    pollInterval: 60_000,
  });

  useEffect(() => {
    if (result.data) setLastFetchTime(Date.now());
  }, [result.data]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const staleness = Math.floor((now - lastFetchTime) / 1000);
  const metrics = result.data?.metrics;
  const hours = metrics?.hours ?? [];

  const totalSessions = hours.reduce((s: number, h: { sessions: number }) => s + h.sessions, 0);
  const totalTokensK = metrics?.totalTokensK ?? 0;
  const totalApi = hours.reduce((s: number, h: { apiCalls: number }) => s + h.apiCalls, 0);
  const totalTool = hours.reduce((s: number, h: { toolCalls: number }) => s + h.toolCalls, 0);
  const totalErrors = metrics?.totalErrors ?? 0;
  const uptimePct = metrics?.uptimePercent ?? 0;
  const validationWarnings = useMetricsValidation(hours);

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

      {/* Freshness indicator */}
      {result.data && (
        <div className={`text-[9px] mb-2 ${
          staleness < 60 ? 'text-emerald-600' :
          staleness < 300 ? 'text-amber-600' : 'text-red-600'
        }`}>
          Updated {staleness < 60 ? 'just now' : `${Math.floor(staleness / 60)}m ago`}
          {staleness >= 300 && ' ⚠️ stale'}
        </div>
      )}

      {/* Validation warnings */}
      {validationWarnings.length > 0 && (
        <div className="mb-2 space-y-1">
          {validationWarnings.map((w, i) => (
            <div key={i} className="text-[9px] text-amber-500 flex items-center gap-1">
              <span>⚠️</span> {w}
            </div>
          ))}
        </div>
      )}

      {/* Row 1: Sessions / Tokens / Calls */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5 relative">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-zinc-400 font-medium">Active Sessions</span>
            <span className="mono text-[11px] text-emerald-400 font-medium">{totalSessions}</span>
          </div>
          <div className="text-[8px] text-zinc-600 mb-1">Y: concurrent sessions · X: hour</div>
          <SessionsChart data={hours} />
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5 relative">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-zinc-400 font-medium">Token Consumption</span>
            <span className="mono text-[11px] text-sky-400 font-medium">{totalTokensK.toFixed(0)}k total</span>
          </div>
          <div className="text-[8px] text-zinc-600 mb-1">Y: tokens (k) · X: hour · cumulative</div>
          <TokensChart data={hours} />
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5 relative">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-zinc-400 font-medium">API / Tool Calls</span>
            <div className="flex gap-2">
              <span className="mono text-[10px] text-violet-400">{totalApi} api</span>
              <span className="mono text-[10px] text-amber-400">{totalTool} tool</span>
            </div>
          </div>
          <div className="text-[8px] text-zinc-600 mb-1">Y: count/h · <span style={{color:'#a78bfa'}}>■</span> API <span style={{color:'#fbbf24'}}>■</span> Tool</div>
          <CallsChart data={hours} />
        </div>
      </div>

      {/* Row 2: Errors (3/5) + Uptime (2/5) */}
      <div className="grid grid-cols-5 gap-2 mt-2">
        <div className="col-span-3 bg-zinc-900/50 border border-red-500/10 rounded-lg px-3 py-2.5 relative">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 font-medium">Gateway Errors</span>
              <span className="text-[8px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded">{totalErrors} today</span>
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-zinc-600"><span style={{color:'#ef4444'}}>■</span> error</span>
              <span className="text-zinc-600"><span style={{color:'#f97316'}}>■</span> warn</span>
              <span className="text-zinc-600"><span style={{color:'#fbbf24'}}>●</span> restart</span>
            </div>
          </div>
          <div className="text-[8px] text-zinc-600 mb-1">Y: error count/h · X: hour · <span style={{color:'#fbbf24'}}>●</span> = restart event</div>
          <ErrorsChart data={hours} />
        </div>
        <div className="col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5 relative">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-zinc-400 font-medium">Gateway Uptime</span>
            <span className="mono text-[11px] text-emerald-400 font-medium">{uptimePct.toFixed(1)}%</span>
          </div>
          <div className="text-[8px] text-zinc-600 mb-1"><span style={{color:'#34d399'}}>■</span> up <span style={{color:'#f97316'}}>■</span> degraded <span style={{color:'#ef4444'}}>■</span> down</div>
          <UptimeStrip data={hours} />
        </div>
      </div>
    </CollapsibleSection>
  );
}
