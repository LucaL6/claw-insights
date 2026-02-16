import { useState, useEffect, useMemo } from 'react';
import { MetricsQuery } from '../../graphql/queries';
import { useReactiveQuery } from '../../hooks/useReactiveQuery';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { SessionsChart } from './SessionsChart';
import { TokensChart } from './TokensChart';
import { ErrorsChart } from './ErrorsChart';
import { UptimeStrip } from './UptimeStrip';
import { useMetricsValidation } from './useMetricsValidation';
import { ChartSkeleton, Skeleton } from '../layout/Skeleton';
import { RangePicker, RANGE_INFO, type MetricsRange } from './GranularityPicker';
import { shortModelName } from './echarts-theme';
import { InfoTooltip } from '../ui/InfoTooltip';
import { TOOLTIPS } from './metricsTooltips';

interface BucketData {
  bucket: number;
  label: string;
  sessions: number;
  tokensK: number;
  tokensByModel?: Array<{ model: string; tokensK: number }>;
  apiCalls: number;
  toolCalls: number;
  errors: number;
  warnings: number;
  gatewayUp: boolean;
  restartEvent: boolean;
}

interface MetricsSectionProps {
  range: MetricsRange;
  onRangeChange: (r: MetricsRange) => void;
}

export function MetricsSection({ range, onRangeChange }: MetricsSectionProps) {
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());

  const variables = useMemo(() => ({ range }), [range]);

  const [result] = useReactiveQuery(
    { query: MetricsQuery, variables, requestPolicy: 'cache-and-network' },
    { sources: ['metrics'] },
  );

  useEffect(() => {
    if (result.data) setLastFetchTime(Date.now());
  }, [result.data]);

  const metrics = result.data?.metrics;
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const buckets: BucketData[] = metrics?.buckets ?? [];

  // Extract unique models from all buckets
  const allModels = useMemo(() => {
    const modelSet = new Set<string>();
    for (const b of buckets) {
      for (const mt of (b.tokensByModel ?? [])) {
        modelSet.add(mt.model);
      }
    }
    return Array.from(modelSet).sort();
  }, [buckets]);

  const rangeInfo = RANGE_INFO[range];

  // ── Fixed summary values ──
  const peakSessions = buckets.length > 0 ? Math.max(...buckets.map(b => b.sessions)) : 0;
  const totalTokensK = buckets.reduce((s: number, b: { tokensK: number }) => s + Number(b.tokensK ?? 0), 0);
  const totalErrors = metrics?.totalErrors ?? 0;
  const uptimePct = metrics?.uptimePercent ?? 0;
  const validationWarnings = useMetricsValidation(buckets);

  if (result.fetching && !result.data) {
    return (
      <CollapsibleSection title="Metrics">
        <div className="flex gap-4 mb-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="mt-3"><ChartSkeleton /></div>
        <div className="mt-3"><ChartSkeleton /></div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Metrics"
      headerRight={<RangePicker value={range} onChange={onRangeChange} />}
      updatedAt={lastFetchTime}
    >
      {/* Summary row */}
      {metrics && (
        <div className="flex gap-5 mb-3 text-[12px]">
          <span className="text-zinc-500">
            Tokens: <span className="text-emerald-400 mono font-semibold">{totalTokensK.toFixed(1)}k</span>
            <InfoTooltip {...TOOLTIPS.summary.summaryTokens} />
          </span>
          <span className="text-zinc-500">
            Errors: <span className="text-red-400 mono font-semibold">{metrics.totalErrors}</span>
            <InfoTooltip {...TOOLTIPS.summary.summaryErrors} />
          </span>
          <span className="text-zinc-500">
            Warnings: <span className="text-amber-400 mono font-semibold">{metrics.totalWarnings}</span>
            <InfoTooltip {...TOOLTIPS.summary.summaryWarnings} />
          </span>
          <span className="text-zinc-500">
            Uptime: <span className="text-emerald-400 mono font-semibold">{metrics.uptimePercent.toFixed(1)}%</span>
            <InfoTooltip {...TOOLTIPS.summary.uptime} />
          </span>
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

      {/* Row 1: Sessions + Tokens (responsive 2-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-zinc-400 font-semibold">
              Active Sessions
              <InfoTooltip {...TOOLTIPS.sections.sessions} />
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="mono text-[15px] text-emerald-400 font-bold">{peakSessions}</span>
              <InfoTooltip {...TOOLTIPS.summary.peakSessions} alignRight />
            </span>
          </div>
          <SessionsChart data={buckets} />
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-zinc-400 font-semibold">
                Token Consumption
                <InfoTooltip {...TOOLTIPS.sections.tokens} />
              </span>
              {allModels.length > 1 && (
                <div className="flex gap-0.5">
                  <button
                    onClick={() => setSelectedModel(null)}
                    className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                      selectedModel === null
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    All
                  </button>
                  {allModels.map(m => {
                    const label = shortModelName(m);
                    return (
                      <button
                        key={m}
                        onClick={() => setSelectedModel(selectedModel === m ? null : m)}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                          selectedModel === m
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <TokensChart data={buckets} selectedModel={selectedModel} />
        </div>
      </div>

      {/* Row 2: Errors (full width) */}
      <div className="mt-3">
        <div className="bg-zinc-900/50 border border-red-500/10 rounded-lg px-4 py-3 relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-red-400 font-semibold">
                Gateway Errors
                <InfoTooltip {...TOOLTIPS.sections.errors} />
              </span>
              <span className="text-[11px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded mono">{totalErrors} in {rangeInfo.label}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-zinc-600"><span style={{color:'#ef4444'}}>■</span> error</span>
              <span className="text-zinc-600"><span style={{color:'#f97316'}}>■</span> warn</span>
              <span className="text-zinc-600"><span style={{color:'#fbbf24'}}>●</span> restart</span>
            </div>
          </div>
          <ErrorsChart data={buckets} />
        </div>
      </div>

      {/* Row 3: Uptime (full width, compact) */}
      <div className="mt-3">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-zinc-400 font-semibold">
              Gateway Uptime
              <InfoTooltip {...TOOLTIPS.sections.uptime} />
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="mono text-[15px] text-emerald-400 font-bold">{uptimePct.toFixed(1)}%</span>
              <InfoTooltip {...TOOLTIPS.summary.uptime} alignRight />
            </span>
          </div>
          <UptimeStrip data={buckets} />
        </div>
      </div>
    </CollapsibleSection>
  );
}
