import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { MetricsQuery } from '../../graphql/queries';
import { useReactiveQuery } from '../../hooks/useReactiveQuery';
import { useQuery } from 'urql';
import { EventsQuery } from '../../graphql/events-queries';
import { PreviewCard } from './PreviewCard';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { SessionsChart } from './SessionsChart';
import { TokensChart } from './TokensChart';
import { ErrorsChart } from './ErrorsChart';
import { UptimeStrip } from './UptimeStrip';
import { useMetricsValidation } from './useMetricsValidation';
import { ChartSkeleton, Skeleton } from '../layout/Skeleton';
import { RangePicker, RANGE_INFO, type MetricsRange } from './GranularityPicker';
import { shortModelName, getModelColor } from './echarts-theme';
import { InfoTooltip } from '../ui/InfoTooltip';
import { TOOLTIPS } from './metricsTooltips';
import { useI18n } from '../../i18n/context';

interface BucketData {
  bucket: number;
  label: string;
  epochStart?: number;
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

function ChartCard({ children, accent }: { children: ReactNode; accent: 'sessions' | 'tokens' | 'errors' | 'uptime' }) {
  return (
    <div
      className="rounded-lg px-4 py-3 relative overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: accent === 'errors' ? '1px solid var(--red-border)' : '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        backgroundImage: `var(--card-bg-${accent})`,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `var(--card-accent-${accent})` }}
      />
      {children}
    </div>
  );
}

interface MetricsSectionProps {
  range: MetricsRange;
  onRangeChange: (r: MetricsRange) => void;
  navigate?: (hash: string) => void;
}

export function MetricsSection({ range, onRangeChange, navigate }: MetricsSectionProps) {
  const { t } = useI18n();
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

  const [preview, setPreview] = useState<{
    source: 'errors' | 'uptime';
    bucketIndex: number;
    fromTs: number;
    toTs: number;
    types: string[];
  } | null>(null);

  const rangeInfo = RANGE_INFO[range];
  const bucketSeconds = (metrics?.bucketMinutes ?? 60) * 60;

  const handleErrorClick = (idx: number) => {
    const b = buckets[idx];
    if (!b?.epochStart) return;
    if (preview?.bucketIndex === idx && preview.source === 'errors') { setPreview(null); return; }
    setPreview({ source: 'errors', bucketIndex: idx, fromTs: b.epochStart, toTs: b.epochStart + bucketSeconds, types: ['error', 'warning'] });
  };

  const handleUptimeClick = (idx: number) => {
    const b = buckets[idx];
    if (!b?.epochStart) return;
    if (preview?.bucketIndex === idx && preview.source === 'uptime') { setPreview(null); return; }
    setPreview({ source: 'uptime', bucketIndex: idx, fromTs: b.epochStart, toTs: b.epochStart + bucketSeconds, types: ['gateway_restart'] });
  };

  const [previewResult] = useQuery({
    query: EventsQuery,
    variables: preview ? { from: preview.fromTs, to: preview.toTs, types: preview.types, limit: 3 } : { limit: 0 },
    pause: !preview,
  });
  const previewEvents = previewResult.data?.events;

  const allModels = useMemo(() => {
    const modelSet = new Set<string>();
    for (const b of buckets) {
      for (const mt of (b.tokensByModel ?? [])) {
        modelSet.add(mt.model);
      }
    }
    return Array.from(modelSet).sort();
  }, [buckets]);

  const peakSessions = buckets.length > 0 ? Math.max(...buckets.map(b => b.sessions)) : 0;
  const totalTokensK = buckets.reduce((s: number, b: { tokensK: number }) => s + Number(b.tokensK ?? 0), 0);
  const totalErrors = metrics?.totalErrors ?? 0;
  const uptimePct = metrics?.uptimePercent ?? 0;
  const validationWarnings = useMetricsValidation(buckets);

  if (result.fetching && !result.data) {
    return (
      <CollapsibleSection title={t('metrics.title')}>
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
      title={t('metrics.title')}
      headerRight={<RangePicker value={range} onChange={onRangeChange} />}
      updatedAt={lastFetchTime}
    >
      {/* Summary row */}
      {metrics && (
        <div className="flex gap-5 mb-3 text-[12px]">
          <span style={{ color: 'var(--text-muted)' }}>
            {t('summary.tokens')}: <span className="mono font-semibold" style={{ color: 'var(--emerald)' }}>{totalTokensK.toFixed(1)}k</span>
            <InfoTooltip {...TOOLTIPS.summary.summaryTokens} />
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {t('summary.errors')}: <span className="mono font-semibold" style={{ color: 'var(--red)' }}>{metrics.totalErrors}</span>
            <InfoTooltip {...TOOLTIPS.summary.summaryErrors} />
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {t('summary.warnings')}: <span className="mono font-semibold" style={{ color: 'var(--amber)' }}>{metrics.totalWarnings}</span>
            <InfoTooltip {...TOOLTIPS.summary.summaryWarnings} />
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {t('summary.uptime')}: <span className="mono font-semibold" style={{ color: 'var(--emerald)' }}>{metrics.uptimePercent.toFixed(1)}%</span>
            <InfoTooltip {...TOOLTIPS.summary.uptime} />
          </span>
        </div>
      )}

      {/* Validation warnings */}
      {validationWarnings.length > 0 && (
        <div className="mb-2 space-y-1">
          {validationWarnings.map((w, i) => (
            <div key={i} className="text-[9px] flex items-center gap-1" style={{ color: 'var(--amber)' }}>
              <span>⚠️</span> {w}
            </div>
          ))}
        </div>
      )}

      {/* Row 1: Sessions + Tokens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard accent="sessions">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              {t('metrics.sessions')}
              <InfoTooltip {...TOOLTIPS.sections.sessions} />
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="mono text-[15px] font-bold" style={{ color: 'var(--emerald)' }}>{peakSessions}</span>
              <InfoTooltip {...TOOLTIPS.summary.peakSessions} alignRight />
            </span>
          </div>
          <SessionsChart data={buckets} />
        </ChartCard>
        <ChartCard accent="tokens">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                {t('metrics.tokens')}
                <InfoTooltip {...TOOLTIPS.sections.tokens} />
              </span>
              {allModels.length > 1 && (
                <div className="flex gap-0.5">
                  <button
                    onClick={() => setSelectedModel(null)}
                    className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
                    style={selectedModel === null
                      ? { backgroundColor: 'var(--toggle-sort-bg)', color: 'var(--toggle-sort-text)', border: '1px solid var(--toggle-sort-border)' }
                      : { color: 'var(--text-dim)' }
                    }
                  >
                    {t('metrics.modelAll')}
                  </button>
                  {allModels.map(m => {
                    const label = shortModelName(m);
                    const dotColor = getModelColor(m);
                    return (
                      <button
                        key={m}
                        onClick={() => setSelectedModel(selectedModel === m ? null : m)}
                        className="text-[9px] px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1"
                        style={selectedModel === m
                          ? { backgroundColor: 'var(--toggle-sort-bg)', color: 'var(--toggle-sort-text)', border: '1px solid var(--toggle-sort-border)' }
                          : { color: 'var(--text-dim)' }
                        }
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <TokensChart data={buckets} selectedModel={selectedModel} />
        </ChartCard>
      </div>

      {/* Row 2: Errors */}
      <div className="mt-3">
        <ChartCard accent="errors">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--red)' }}>
                {t('metrics.errors')}
                <InfoTooltip {...TOOLTIPS.sections.errors} />
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded mono" style={{ backgroundColor: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)' }}>
                {t('metrics.errorInRange', { count: totalErrors, range: rangeInfo.label })}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-dim)' }}>
              <span><span style={{color:'#ef4444'}}>■</span> {t('metrics.legendError')}</span>
              <span><span style={{color:'#f97316'}}>■</span> {t('metrics.legendWarn')}</span>
              <span><span style={{color:'#fbbf24'}}>●</span> {t('metrics.legendRestart')}</span>
            </div>
          </div>
          <ErrorsChart data={buckets} onBucketClick={handleErrorClick} />
        </ChartCard>
        {preview?.source === 'errors' && previewEvents && navigate && (
          <PreviewCard
            source="errors"
            title="Gateway Errors"
            timeLabel={buckets[preview.bucketIndex]?.label ?? ''}
            events={previewEvents.events}
            total={previewEvents.total}
            linkHref={`#logs?from=${preview.fromTs}&to=${preview.toTs}&type=${preview.types.join(',')}`}
            onClose={() => setPreview(null)}
            onNavigate={navigate}
          />
        )}
      </div>

      {/* Row 3: Uptime */}
      <div className="mt-3">
        <ChartCard accent="uptime">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              {t('metrics.uptime')}
              <InfoTooltip {...TOOLTIPS.sections.uptime} />
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="mono text-[15px] font-bold" style={{ color: 'var(--emerald)' }}>{uptimePct.toFixed(1)}%</span>
              <InfoTooltip {...TOOLTIPS.summary.uptime} alignRight />
            </span>
          </div>
          <UptimeStrip data={buckets} onCellClick={handleUptimeClick} />
        </ChartCard>
        {preview?.source === 'uptime' && previewEvents && navigate && (
          <PreviewCard
            source="uptime"
            title="Gateway Restart"
            timeLabel={buckets[preview.bucketIndex]?.label ?? ''}
            events={previewEvents.events}
            total={previewEvents.total}
            linkHref={`#logs?from=${preview.fromTs}&to=${preview.toTs}&type=gateway_restart`}
            onClose={() => setPreview(null)}
            onNavigate={navigate}
          />
        )}
      </div>
    </CollapsibleSection>
  );
}
