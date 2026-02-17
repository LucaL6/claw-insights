import { useState } from 'react';
import type { Page } from '../../hooks/useHashRoute';
import { GatewayQuery, ResourcesQuery, ChannelsQuery } from '../../graphql/queries';
import { useReactiveQuery } from '../../hooks/useReactiveQuery';
import type { MetricsRange } from '../charts/GranularityPicker';
import { InfoTooltip } from '../ui/InfoTooltip';
import { useTheme } from '../../theme/context';
import { useI18n } from '../../i18n/context';

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

export function TopBar({ currentPage, onNavigate, onAction, metricsRange }: {
  currentPage?: Page;
  onNavigate?: (hash: string) => void;
  onAction?: (action: 'restart' | 'doctor' | 'update') => void;
  metricsRange?: MetricsRange;
}) {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const [screenshotting, setScreenshotting] = useState(false);

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
  const gateway = gw.data?.gateway;
  const resources = res.data?.resources;
  const channels = (ch.data?.channels ?? []) as Array<{ name: string; connected: boolean; latencyMs: number | null; provider: string }>;

  const uptime = formatUptime(gateway?.startedAt);
  const version = gateway?.version ?? '...';
  const latestVersion = gateway?.latestVersion as string | null;
  const updateLabel = latestVersion
    ? (latestVersion.startsWith(version.slice(0, -2)) ? '.' + latestVersion.split('.').pop() : latestVersion)
    : null;

  return (
    <div className="flex items-center justify-between text-xs">
      {/* Left: Logo + Version + Status + Channels */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="w-5 h-5" style={{ filter: 'var(--icon-filter, none)' }} />
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('brand.name')}</span>
          {gw.fetching && !gw.data
            ? <span className="inline-block w-16 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--skeleton)' }} />
            : <span className="text-[10px] mono" style={{ color: 'var(--text-dim)' }}>v{version}</span>
          }
        </div>

        {/* UP / DOWN / CONNECTING */}
        {gw.fetching && !gw.data ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--text-dim)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{t('topbar.connecting')}</span>
          </div>
        ) : gateway?.running ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--emerald-bg)', border: '1px solid var(--emerald-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: 'var(--emerald)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--emerald)' }}>{t('topbar.up')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--red)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--red)' }}>{t('topbar.down')}</span>
          </div>
        )}

        {/* Channels */}
        {ch.fetching && !ch.data ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: 'var(--text-dim)' }} />
            <span className="inline-block w-12 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--skeleton)' }} />
          </div>
        ) : channels.map((c) => (
          <div key={c.name} className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: c.connected ? 'var(--emerald)' : 'var(--red)' }} />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{channelShortName(c.name)}</span>
            {c.latencyMs !== null && (
              <span className="text-[10px] mono" style={{ color: 'var(--text-dim)' }}>{formatLatency(c.latencyMs)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Nav tabs */}
      <div className="inline-flex rounded-lg p-0.5 gap-px" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <button
          onClick={() => onNavigate?.('#dashboard')}
          className="text-[11px] font-semibold px-4 py-1 rounded-md transition-all"
          style={currentPage === 'dashboard'
            ? { backgroundColor: 'var(--bg-surface-solid)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }
            : { color: 'var(--text-dim)' }
          }
        >
          {t('nav.dashboard')}
        </button>
        <button
          onClick={() => onNavigate?.('#logs')}
          className="text-[11px] font-semibold px-4 py-1 rounded-md transition-all"
          style={currentPage === 'logs'
            ? { backgroundColor: 'var(--bg-surface-solid)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }
            : { color: 'var(--text-dim)' }
          }
        >
          {t('nav.logs')}
        </button>
      </div>

      {/* Center: System metrics | Aggregate stats */}
      <div className="flex items-center gap-2 text-[10px]">
        {res.fetching && !res.data ? (
          <div className="flex items-center gap-3 px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-dim)' }}>{t('topbar.cpu')}</span>
            <span className="inline-block w-8 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--skeleton)' }} />
            <span className="w-px h-3" style={{ backgroundColor: 'var(--border)' }} />
            <span style={{ color: 'var(--text-dim)' }}>{t('topbar.mem')}</span>
            <span className="inline-block w-8 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--skeleton)' }} />
          </div>
        ) : resources ? (
          <div className="flex items-center gap-3 px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-dim)' }}>{t('topbar.cpu')}</span>
            <span className="mono" style={{ color: 'var(--text-secondary)' }}>{resources.cpu.toFixed(1)}%</span>
            <InfoTooltip label="Gateway 进程 CPU 使用率" detail="ps -o pcpu= -p <gateway_pid> · real-time" />
            <span className="w-px h-3" style={{ backgroundColor: 'var(--border)' }} />
            <span style={{ color: 'var(--text-dim)' }}>{t('topbar.mem')}</span>
            <span className="mono" style={{ color: 'var(--text-secondary)' }}>{resources.memoryMB}M</span>
            <InfoTooltip label="Gateway 进程内存占用 (RSS)" detail="ps -o rss= -p <gateway_pid> · real-time" />
          </div>
        ) : null}
      </div>

      {/* Right: Actions + Toggles + Uptime */}
      <div className="flex items-center gap-2">
        <button
          disabled={screenshotting}
          onClick={async () => {
            setScreenshotting(true);
            try {
              const section = currentPage === 'logs' ? 'logs' : 'dashboard';
              const params = new URLSearchParams({ section, range: metricsRange ?? 'TWENTY_FOUR_HOUR', theme, lang });
              const res = await fetch(`/api/screenshot?${params}`);
              if (!res.ok) throw new Error('Screenshot failed');
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `claw-insights-${section}-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.png`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) {
              console.error('[screenshot]', e);
            } finally {
              setScreenshotting(false);
            }
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all"
          style={{
            backgroundColor: screenshotting ? 'var(--emerald-bg)' : 'var(--bg-elevated)',
            color: screenshotting ? 'var(--emerald)' : 'var(--text-secondary)',
            border: screenshotting ? '1px solid var(--emerald-border)' : '1px solid var(--border)',
            opacity: screenshotting ? 0.8 : 1,
          }}
          title={t('topbar.screenshot')}
        >
          {screenshotting ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
          )}
          {screenshotting ? t('topbar.screenshotting') : t('topbar.screenshot')}
        </button>
        <button
          onClick={() => onAction?.('restart')}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {t('topbar.restart')}
        </button>
        <button
          onClick={() => onAction?.('doctor')}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          {t('topbar.doctor')}
        </button>

        {updateLabel && (
          <button
            onClick={() => onAction?.('update')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all"
            style={{ backgroundColor: 'var(--orange-bg)', color: 'var(--orange)', border: '1px solid var(--orange-border)' }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {updateLabel}
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-7 h-7 flex items-center justify-center text-sm rounded-md transition-colors"
          style={{ backgroundColor: 'var(--theme-btn-bg)', color: 'var(--theme-btn-text)', border: '1px solid var(--border-subtle)' }}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="w-7 h-7 flex items-center justify-center text-sm rounded-md transition-colors"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
          title={lang === 'en' ? 'Switch to 中文' : 'Switch to English'}
        >
          🌐
        </button>

        {uptime && (
          <>
            <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border)' }} />
            <span className="text-[10px] mono" style={{ color: 'var(--text-dim)' }}>⏱ {uptime}</span>
          </>
        )}
      </div>
    </div>
  );
}
