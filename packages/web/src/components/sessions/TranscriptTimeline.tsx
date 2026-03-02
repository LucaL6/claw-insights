import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

import { useI18n } from '../../i18n/context';
import { TruncatedContent } from '../ui/TruncatedContent';

interface Message {
  timestamp: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  contentTruncated: boolean;
  model?: string;
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  toolName?: string;
}

export type TimelineState =
  | { status: 'loading' }
  | { status: 'error'; errorCode?: string; retry: () => void }
  | { status: 'empty' }
  | {
      status: 'ready';
      messages: Message[];
      totalMessages: number;
      hasMore: boolean;
      loadingMore?: boolean;
    };

export interface TranscriptTimelineProps {
  state: TimelineState;
  onLoadMore?: () => void;
  /** Ref to the external scrollable container (for virtualizer scroll element) */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  /** When set, scroll to this message index */
  jumpToIndex?: number;
  /** Incrementing key to allow repeated jumps to the same index */
  jumpKey?: number;
}

const ROLE_CONFIG = {
  user: { label: 'user', color: 'var(--dr-indigo)', dotSize: 8 },
  assistant: { label: 'assistant', color: 'var(--dr-teal)', dotSize: 8 },
  tool: { label: 'TOOL', color: 'var(--dr-rose)', dotSize: 5 },
} as const;

/** Shorten model id: "anthropic/claude-opus-4-6" → "opus-4-6", "openai/gpt-4o" → "gpt-4o" */
function formatModelShort(model: string): string {
  // Strip provider prefix
  const name = model.includes('/') ? model.split('/').slice(1).join('/') : model;
  // Common Claude shortenings
  return name.replace(/^claude-/, '').replace(/^models\//, '');
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '--:--';
    }
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '--:--';
  }
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function MessageContent({ content }: { content: string }) {
  return (
    <div className="transcript-md">
      <Markdown rehypePlugins={[rehypeHighlight]}>{content}</Markdown>
    </div>
  );
}

function TimelineRow({ msg, isLast, index }: { msg: Message; isLast: boolean; index: number }) {
  const { t } = useI18n();
  const cfg = ROLE_CONFIG[msg.role];

  return (
    <div className="flex min-h-[24px]" data-msg-index={index}>
      {/* Timeline column */}
      <div className="relative flex w-5 shrink-0 flex-col items-center">
        <div
          className="z-10 shrink-0 rounded-full"
          style={{
            width: cfg.dotSize,
            height: cfg.dotSize,
            backgroundColor: cfg.color,
            marginTop: cfg.dotSize === 5 ? 6 : 5,
          }}
        />
        {!isLast && <div className="flex-1" style={{ width: 1, backgroundColor: 'var(--dr-border)' }} />}
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1 pb-2 pt-0.5 pl-2">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="shrink-0 font-mono text-[11px] font-medium" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          <span className="shrink-0 font-mono text-[10px]" style={{ color: 'var(--dr-dim)' }}>
            {formatTime(msg.timestamp)}
          </span>
          {msg.role === 'assistant' && msg.model && (
            <span
              className="shrink-0 font-mono text-[10px] cursor-default"
              style={{ color: 'var(--dr-dim)', opacity: 0.7 }}
              title={msg.model}
            >
              {formatModelShort(msg.model)}
            </span>
          )}
          {msg.role === 'assistant' && msg.usage && (
            <span
              className="font-mono text-[10px] ml-auto cursor-default"
              style={{ color: 'var(--dr-dim)' }}
              title={[
                `${t('drawer.token.input')}: ${msg.usage.input.toLocaleString()}`,
                `${t('drawer.token.output')}: ${msg.usage.output.toLocaleString()}`,
                msg.usage.cacheRead > 0
                  ? `${t('drawer.token.cacheRead')}: ${msg.usage.cacheRead.toLocaleString()}`
                  : '',
                msg.usage.cacheWrite > 0
                  ? `${t('drawer.token.cacheWrite')}: ${msg.usage.cacheWrite.toLocaleString()}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n')}
            >
              in:{formatTokens(msg.usage.input)} out:{formatTokens(msg.usage.output)}
              {msg.usage.cacheRead > 0 && ` cache:${formatTokens(msg.usage.cacheRead)}`}
            </span>
          )}
        </div>

        <div className="font-mono text-[12px] leading-relaxed" style={{ color: 'var(--dr-fg2)' }}>
          <TruncatedContent
            maxHeight={72}
            expandLabel={t('drawer.truncated.expand')}
            collapseLabel={t('drawer.truncated.collapse')}
          >
            {msg.role === 'tool' && msg.toolName ? (
              <div>
                <span
                  className="inline-block font-mono text-[10px] px-1 rounded mr-1.5 mb-0.5"
                  style={{ background: 'var(--dr-rose-bg)', color: 'var(--dr-rose)' }}
                >
                  {msg.toolName}
                </span>
                <span className="whitespace-pre-wrap break-words" style={{ color: 'var(--dr-muted)' }}>
                  {msg.content}
                </span>
              </div>
            ) : (
              <MessageContent content={msg.content} />
            )}
          </TruncatedContent>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-4 py-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="flex w-5 justify-center">
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: 'var(--dr-border)' }} />
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-12 animate-pulse rounded" style={{ backgroundColor: 'var(--dr-border)' }} />
              <div className="h-2 w-10 animate-pulse rounded" style={{ backgroundColor: 'var(--dr-border)' }} />
            </div>
            <div
              className="h-3 animate-pulse rounded"
              style={{ backgroundColor: 'var(--dr-border)', width: `${55 + i * 12}%` }}
            />
            {i % 2 === 0 && (
              <div
                className="h-3 animate-pulse rounded"
                style={{ backgroundColor: 'var(--dr-border)', width: `${35 + i * 8}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const VIRTUAL_THRESHOLD = 50;

/**
 * Virtualized timeline — uses the external scroll container as scroll element.
 * Does NOT create its own scrollable wrapper; it outputs a single tall div
 * with absolutely-positioned rows that the parent scroll container scrolls.
 */
function VirtualizedTimeline({
  messages,
  hasMore,
  totalMessages,
  loadingMore,
  onLoadMore,
  scrollRef,
  jumpToIndex,
  jumpKey,
}: {
  messages: Message[];
  hasMore: boolean;
  totalMessages: number;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  jumpToIndex?: number;
  jumpKey?: number;
}) {
  const { t } = useI18n();
  const remaining = totalMessages - messages.length;

  const rowCount = messages.length + (hasMore ? 1 : 0);
  const listRef = useRef<HTMLDivElement>(null);

  // Measure offset of virtualizer container relative to scroll container
  // This accounts for SpawnPromptBox and other content above the list
  const [scrollMargin, setScrollMargin] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure on every render to catch dynamic content changes (SpawnPromptBox expand)
  useEffect(() => {
    const list = listRef.current;
    if (list) {
      setScrollMargin(list.offsetTop);
    }
  });

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 15,
    scrollMargin,
  });

  // Jump to index when requested (keyed to allow repeated jumps)
  const lastJumpKey = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (jumpToIndex === undefined || jumpKey === undefined || jumpKey === lastJumpKey.current) {
      return;
    }
    lastJumpKey.current = jumpKey;

    // For large jumps (>30 rows), use instant scroll then re-align after measurement
    const currentRange = virtualizer.range;
    const distance = currentRange ? Math.abs(jumpToIndex - (currentRange.startIndex + currentRange.endIndex) / 2) : 0;
    const isLargeJump = distance > 30;

    virtualizer.scrollToIndex(jumpToIndex, { align: 'start', behavior: isLargeJump ? 'auto' : 'smooth' });

    // Re-scroll after measurements settle (estimated sizes may be off for unmeasured rows)
    if (isLargeJump) {
      const timer = setTimeout(() => {
        virtualizer.scrollToIndex(jumpToIndex, { align: 'start', behavior: 'auto' });
      }, 50);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [jumpToIndex, jumpKey, virtualizer]);

  return (
    <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
      {virtualizer.getVirtualItems().map((vItem) => {
        if (vItem.index === messages.length) {
          return (
            <div
              key="load-more"
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vItem.start - scrollMargin}px)`,
              }}
            >
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="w-full py-3 font-mono text-[11px] cursor-pointer transition-colors text-center"
                style={{ color: loadingMore ? 'var(--dr-dim)' : 'var(--dr-orange)' }}
              >
                {loadingMore
                  ? t('drawer.timeline.loading')
                  : `↓ ${t('drawer.timeline.moreMessages', { count: remaining })}`}
              </button>
            </div>
          );
        }

        const msg = messages[vItem.index];
        return (
          <div
            key={vItem.index}
            ref={virtualizer.measureElement}
            data-index={vItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vItem.start - scrollMargin}px)`,
            }}
          >
            <TimelineRow msg={msg} index={vItem.index} isLast={vItem.index === messages.length - 1 && !hasMore} />
          </div>
        );
      })}
    </div>
  );
}

function PlainTimeline({
  messages,
  hasMore,
  totalMessages,
  loadingMore,
  onLoadMore,
  jumpToIndex,
  jumpKey,
  scrollRef,
}: {
  messages: Message[];
  hasMore: boolean;
  totalMessages: number;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  jumpToIndex?: number;
  jumpKey?: number;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useI18n();
  const remaining = totalMessages - messages.length;

  const lastJumpKey = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (jumpToIndex !== undefined && jumpKey !== undefined && jumpKey !== lastJumpKey.current) {
      lastJumpKey.current = jumpKey;
      const container = scrollRef?.current;
      if (!container) {
        return;
      }
      const target = container.querySelector(`[data-msg-index="${jumpToIndex}"]`);
      if (!target) {
        return;
      }
      // Use instant for large distance jumps
      const rect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const distance = Math.abs(rect.top - containerRect.top);
      target.scrollIntoView({ behavior: distance > 2000 ? 'auto' : 'smooth', block: 'start' });
    }
  }, [jumpToIndex, jumpKey, scrollRef]);

  return (
    <div className="flex flex-col">
      {messages.length > 0 && (
        <div className="flex items-center gap-1.5 pb-2 font-mono text-[10px]" style={{ color: 'var(--dr-fg2)' }}>
          <span style={{ color: 'var(--dr-dim)' }}>·</span>
          <span>{t('drawer.timeline.sessionStarted')}</span>
          <span style={{ color: 'var(--dr-dim)' }}>·</span>
          <span>{formatTime(messages[0].timestamp)}</span>
        </div>
      )}

      {messages.map((msg, i) => (
        <TimelineRow key={i} msg={msg} index={i} isLast={i === messages.length - 1 && !hasMore} />
      ))}

      {hasMore && remaining > 0 && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="py-2 font-mono text-[11px] cursor-pointer transition-colors text-left"
          style={{ color: loadingMore ? 'var(--dr-dim)' : 'var(--dr-orange)' }}
        >
          {loadingMore ? t('drawer.timeline.loading') : `↓ ${t('drawer.timeline.moreMessages', { count: remaining })}`}
        </button>
      )}
    </div>
  );
}

export function TranscriptTimeline({ state, onLoadMore, scrollRef, jumpToIndex, jumpKey }: TranscriptTimelineProps) {
  const { t } = useI18n();
  const fallbackRef = useRef<HTMLDivElement | null>(null);

  if (state.status === 'loading') {
    return <SkeletonRows />;
  }

  if (state.status === 'empty') {
    return (
      <div className="flex items-center justify-center py-8 font-mono text-xs" style={{ color: 'var(--dr-dim)' }}>
        {t('drawer.empty')}
      </div>
    );
  }

  if (state.status === 'error') {
    const errorMsg =
      state.errorCode === 'NOT_AVAILABLE'
        ? t('drawer.error.notAvailable')
        : state.errorCode === 'TRANSCRIPT_TOO_LARGE'
          ? t('drawer.error.tooLarge')
          : t('drawer.error.loadFailed');
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8">
        <span className="font-mono text-xs" style={{ color: 'var(--dr-dim)' }}>
          {errorMsg}
        </span>
        <button onClick={state.retry} className="font-mono text-[10px] underline" style={{ color: 'var(--dr-teal)' }}>
          {t('drawer.error.retry')}
        </button>
      </div>
    );
  }

  const { messages, totalMessages, hasMore, loadingMore } = state;
  const effectiveRef = scrollRef ?? fallbackRef;
  const useVirtual = messages.length > VIRTUAL_THRESHOLD && scrollRef !== undefined;

  if (useVirtual) {
    return (
      <>
        {/* Session started marker */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1.5 pb-2 font-mono text-[10px]" style={{ color: 'var(--dr-fg2)' }}>
            <span style={{ color: 'var(--dr-dim)' }}>·</span>
            <span>{t('drawer.timeline.sessionStarted')}</span>
            <span style={{ color: 'var(--dr-dim)' }}>·</span>
            <span>{formatTime(messages[0].timestamp)}</span>
          </div>
        )}
        <VirtualizedTimeline
          messages={messages}
          hasMore={hasMore}
          totalMessages={totalMessages}
          loadingMore={loadingMore}
          onLoadMore={onLoadMore}
          scrollRef={effectiveRef}
          jumpToIndex={jumpToIndex}
          jumpKey={jumpKey}
        />
      </>
    );
  }

  return (
    <PlainTimeline
      messages={messages}
      hasMore={hasMore}
      totalMessages={totalMessages}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      jumpToIndex={jumpToIndex}
      jumpKey={jumpKey}
      scrollRef={effectiveRef}
    />
  );
}
