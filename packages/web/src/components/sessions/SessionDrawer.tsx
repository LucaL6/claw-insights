import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useSessionTranscript } from '../../hooks/useSessionTranscript';
import { useTranscriptNavigator } from '../../hooks/useTranscriptNavigator';
import { useI18n } from '../../i18n/context';
import { formatModel } from '../../utils/formatModel';
import { dismissToast, replaceToast, showToast } from '../ui/toast-store';
import { SpawnPromptBox } from './SpawnPromptBox';
import { TimelineScrubber } from './TimelineScrubber';
import { buildTranscriptAnchorId, resolveAnchorIndex, type TranscriptAnchor } from './transcriptAnchor';
import { type TimelineState, TranscriptTimeline } from './TranscriptTimeline';

interface SessionDrawerProps {
  sessionKey: string;
  onClose: () => void;
  status?: string;
  displayName?: string;
}

const JUMP_COOLDOWN_MS = 600;

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms <= 0) {
    return '0s';
  }
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) {
    return `${totalSec}s`;
  }
  const min = Math.floor(totalSec / 60);
  if (min < 60) {
    return `${min}m`;
  }
  const hr = Math.floor(min / 60);
  const remainMin = min % 60;
  return remainMin > 0 ? `${hr}h${remainMin}m` : `${hr}h`;
}

function formatDateTime(isoOrEpoch: string | number): string {
  return new Date(isoOrEpoch).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-3 w-32 rounded" style={{ backgroundColor: 'var(--dr-border)' }} />
        <div className="h-3 w-16 rounded ml-auto" style={{ backgroundColor: 'var(--dr-border)' }} />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-24 rounded" style={{ backgroundColor: 'var(--dr-border)' }} />
        <div className="h-2.5 w-16 rounded" style={{ backgroundColor: 'var(--dr-border)' }} />
      </div>
      <div className="flex items-center gap-4 mt-1">
        <div className="h-5 w-12 rounded" style={{ backgroundColor: 'var(--dr-border)' }} />
        <div className="h-5 w-12 rounded" style={{ backgroundColor: 'var(--dr-border)' }} />
        <div className="h-5 w-12 rounded" style={{ backgroundColor: 'var(--dr-border)' }} />
      </div>
    </div>
  );
}

export function SessionDrawer({ sessionKey, onClose, status, displayName: externalName }: SessionDrawerProps) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTickRef = useRef(false);
  const jumpCooldownRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const {
    meta,
    messages,
    isInitialLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    totalMessages,
    isFetching,
    error,
    refresh,
    loadMore,
    retry,
  } = useSessionTranscript({ sessionKey });

  const { jumpRequest, visibleIndex, setVisibleIndex, jumpToIndex, jumpToEnd, isLoadingToEnd } = useTranscriptNavigator(
    {
      totalMessages,
      loadedCount: messages.length,
      hasMore,
      isLoadingMore,
      isFetching,
      loadMore,
    },
  );

  const resolvedName = externalName || meta?.displayName || sessionKey.split(':').pop() || sessionKey;
  const spawnPrompt = meta?.isSubAgent && meta.spawnPrompt ? meta.spawnPrompt : undefined;

  const refreshToastRef = useRef<number | undefined>(undefined);
  const previousRefreshingRef = useRef(false);
  const refreshAnchorRef = useRef<TranscriptAnchor | undefined>(undefined);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      clearTimeout(cooldownTimerRef.current);
      if (refreshToastRef.current !== undefined) {
        dismissToast(refreshToastRef.current);
        refreshToastRef.current = undefined;
      }
    };
  }, [onClose]);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      triggerRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const wasRefreshing = previousRefreshingRef.current;

    if (isRefreshing && !wasRefreshing) {
      refreshToastRef.current = showToast(t('drawer.refresh.loading'), 'loading');

      const anchorMessage = visibleIndex !== undefined ? messages[visibleIndex] : undefined;
      refreshAnchorRef.current =
        visibleIndex !== undefined
          ? {
              index: visibleIndex,
              id: anchorMessage ? buildTranscriptAnchorId(anchorMessage) : undefined,
            }
          : undefined;
    }

    if (!isRefreshing && wasRefreshing) {
      if (refreshToastRef.current !== undefined) {
        replaceToast(refreshToastRef.current, t('drawer.refresh.done'), 'success');
        refreshToastRef.current = undefined;
      }

      const resolvedIndex = resolveAnchorIndex(refreshAnchorRef.current, messages);
      refreshAnchorRef.current = undefined;

      if (resolvedIndex !== undefined && resolvedIndex > 0) {
        jumpToIndex(resolvedIndex);
      }
    }

    previousRefreshingRef.current = isRefreshing;
  }, [isRefreshing, jumpToIndex, messages, t, visibleIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const timelineState: TimelineState = useMemo(() => {
    if (isRefreshing || (isInitialLoading && messages.length === 0)) {
      return { status: 'loading' };
    }

    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const gqlCode = error.graphQLErrors?.[0]?.extensions?.code as string | undefined;
      return {
        status: 'error',
        errorCode: gqlCode,
        retry,
      };
    }

    if (!meta) {
      if (isInitialLoading) {
        return { status: 'loading' };
      }
      return {
        status: 'error',
        errorCode: 'NOT_AVAILABLE',
        retry,
      };
    }

    if (totalMessages === 0) {
      return { status: 'empty' };
    }

    return {
      status: 'ready',
      messages,
      totalMessages,
      hasMore,
      loadingMore: isLoadingMore,
    };
  }, [isRefreshing, isInitialLoading, messages, error, retry, meta, totalMessages, hasMore, isLoadingMore]);

  const isLoading = isInitialLoading;
  const resolvedStatus = status ?? (meta ? 'DONE' : 'ACTIVE');
  const statusColor =
    resolvedStatus === 'ACTIVE' ? 'var(--dr-teal)' : resolvedStatus === 'FAILED' ? 'var(--dr-rose)' : 'var(--dr-dim)';

  const timestamps = useMemo(() => {
    if (timelineState.status !== 'ready') {
      return [];
    }
    return timelineState.messages.map((m) => m.timestamp);
  }, [timelineState]);

  const handleJump = useCallback(
    (index: number) => {
      jumpToIndex(index);
      jumpCooldownRef.current = true;
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = setTimeout(() => {
        jumpCooldownRef.current = false;
      }, JUMP_COOLDOWN_MS);
    },
    [jumpToIndex],
  );

  const handleScroll = useCallback(() => {
    if (scrollTickRef.current || jumpCooldownRef.current) {
      return;
    }
    scrollTickRef.current = true;
    requestAnimationFrame(() => {
      scrollTickRef.current = false;
      const container = scrollRef.current;
      if (!container) {
        return;
      }
      const containerTop = container.getBoundingClientRect().top;
      const elements = container.querySelectorAll('[data-msg-index]');
      let closest: number | undefined;
      let closestDist = Infinity;

      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        const dist = Math.abs(rect.top - containerTop);
        if (dist < closestDist) {
          closestDist = dist;
          closest = Number(element.getAttribute('data-msg-index'));
        }
        if (rect.top > containerTop + 200) {
          break;
        }
      }

      if (closest !== undefined) {
        setVisibleIndex(closest);
      }
    });
  }, [setVisibleIndex]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={t('drawer.ariaLabel')}
    >
      <div onClick={onClose} className="absolute inset-0 bg-black/40" />

      <div
        role="document"
        ref={panelRef}
        onKeyDown={handleKeyDown}
        className="relative w-full sm:w-[85vw] md:w-[55vw] lg:w-[680px] lg:max-w-[50vw] h-full overflow-hidden flex flex-col font-mono"
        style={{
          backgroundColor: 'var(--dr-bg)',
          borderLeft: '1px solid var(--dr-border)',
          color: 'var(--dr-fg)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex-shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5 mb-2">
            <button
              ref={closeRef}
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 text-xs transition-colors"
              style={{
                border: '1px solid var(--dr-border)',
                backgroundColor: 'var(--dr-surface)',
                color: 'var(--dr-fg2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--dr-rose-bg)';
                e.currentTarget.style.color = 'var(--dr-rose)';
                e.currentTarget.style.borderColor = 'var(--dr-rose)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--dr-surface)';
                e.currentTarget.style.color = 'var(--dr-fg2)';
                e.currentTarget.style.borderColor = 'var(--dr-border)';
              }}
              aria-label={t('drawer.close')}
            >
              ✕
            </button>
            <span
              className="font-bold text-base truncate flex-1"
              style={{ fontFamily: "'Space Grotesk', var(--font-title, sans-serif)", color: 'var(--dr-fg)' }}
            >
              {resolvedName}
            </span>
            {meta?.isSubAgent && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium"
                style={{
                  backgroundColor: 'var(--dr-amber-bg)',
                  color: 'var(--dr-amber)',
                  border: '1px solid var(--dr-amber-border)',
                }}
              >
                {t('drawer.subAgentBadge')}
              </span>
            )}
            {!isLoading && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: statusColor,
                    boxShadow: resolvedStatus === 'ACTIVE' ? `0 0 4px ${statusColor}` : undefined,
                  }}
                />
                <span className="text-[11px] font-medium" style={{ color: statusColor }}>
                  {resolvedStatus}
                </span>
              </div>
            )}
          </div>

          {isLoading ? (
            <HeaderSkeleton />
          ) : meta ? (
            <>
              <div className="flex items-center gap-1.5 text-[11px] flex-wrap" style={{ color: 'var(--dr-dim)' }}>
                <span>{formatModel(meta.model)}</span>
                {meta.channel && (
                  <>
                    <span>·</span>
                    <span>{meta.channel}</span>
                  </>
                )}
                {meta.thinkingLevel && (
                  <>
                    <span>·</span>
                    <span>
                      {t('drawer.meta.thinking')}
                      {meta.thinkingLevel}
                    </span>
                  </>
                )}
              </div>

              <div
                className="flex items-center gap-4 mt-3 pt-3 text-[11px] flex-wrap"
                style={{ borderTop: '1px solid var(--dr-border)', color: 'var(--dr-dim)' }}
              >
                <div>
                  {t('drawer.stats.turns')}{' '}
                  <span
                    className="font-semibold text-base ml-0.5"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--dr-fg)' }}
                  >
                    {totalMessages}
                  </span>
                </div>
                <div>
                  {t('drawer.stats.tokens')}{' '}
                  <span
                    className="font-semibold text-base ml-0.5"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--dr-fg)' }}
                  >
                    {formatTokens(meta.totalTokens)}
                  </span>
                </div>
                <div>
                  {t('drawer.stats.context')}{' '}
                  <span
                    className="font-semibold text-base ml-0.5"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--dr-fg)' }}
                  >
                    {formatTokens(meta.contextTokens)}
                  </span>
                </div>
                <div>
                  {t('drawer.stats.duration')}{' '}
                  <span
                    className="font-semibold text-base ml-0.5"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--dr-fg)' }}
                  >
                    {formatDuration(meta.durationMs)}
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {timestamps.length >= 2 && (
          <div className="flex-shrink-0 px-5" style={{ borderTop: '1px solid var(--dr-border)' }}>
            <TimelineScrubber
              timestamps={timestamps}
              activeIndex={visibleIndex}
              onJump={handleJump}
              totalMessages={totalMessages}
              onJumpToEnd={jumpToEnd}
              isLoadingToEnd={isLoadingToEnd}
            />
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-3 drawer-scroll"
          onScroll={handleScroll}
          style={timestamps.length < 2 ? { borderTop: '1px solid var(--dr-border)' } : undefined}
        >
          {spawnPrompt && (
            <div className="mb-3">
              <SpawnPromptBox prompt={spawnPrompt} />
            </div>
          )}
          <TranscriptTimeline
            state={timelineState}
            onLoadMore={loadMore}
            scrollRef={scrollRef}
            jumpToIndex={jumpRequest?.index}
            jumpKey={jumpRequest?.key}
          />
        </div>

        {meta && (
          <div
            className="flex-shrink-0 px-5 py-1.5 text-[10px] flex items-center justify-between"
            style={{ borderTop: '1px solid var(--dr-border)', color: 'var(--dr-dim)' }}
          >
            <span>{t('drawer.footer.started', { time: formatDateTime(meta.startedAt) })}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="dr-refresh-btn w-6 h-6 flex items-center justify-center rounded-md shrink-0 transition-colors"
                aria-label={t('drawer.refresh')}
                title={t('drawer.refresh')}
                aria-busy={isRefreshing}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={isRefreshing ? { animation: 'dr-spin 0.8s linear infinite' } : undefined}
                >
                  <path d="M1.5 1.5v4h4" />
                  <path d="M3.1 10a5.5 5.5 0 1 0 1.06-5.57L1.5 5.5" />
                </svg>
              </button>
              <span>{t('drawer.footer.messages', { shown: messages.length, total: totalMessages })}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
