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
      hasPreviousPage: boolean;
      loadingOlder?: boolean;
    };

export interface TranscriptTimelineProps {
  state: TimelineState;
  onLoadOlder?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  jumpToIndex?: number;
  jumpKey?: number;
}

const ROLE_CONFIG = {
  user: { label: 'user', color: 'var(--dr-indigo)', dotSize: 8 },
  assistant: { label: 'assistant', color: 'var(--dr-teal)', dotSize: 8 },
  tool: { label: 'TOOL', color: 'var(--dr-rose)', dotSize: 5 },
} as const;

function formatModelShort(model: string): string {
  if (!model) {
    return '';
  }
  const afterSlash = model.includes('/') ? model.split('/').slice(1).join('/') : model;
  if (!afterSlash) {
    return model;
  }
  return afterSlash.replace(/^models\//, '').replace(/^claude-/, '');
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '--:--:--';
    }
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  } catch {
    return '--:--:--';
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
            <span className="font-mono text-[10px] ml-auto cursor-default" style={{ color: 'var(--dr-dim)' }}>
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
          </div>
        </div>
      ))}
    </div>
  );
}

const VIRTUAL_THRESHOLD = 50;

function VirtualizedTimeline({
  messages,
  hasPreviousPage,
  totalMessages,
  loadingOlder,
  onLoadOlder,
  scrollRef,
  jumpToIndex,
  jumpKey,
}: {
  messages: Message[];
  hasPreviousPage: boolean;
  totalMessages: number;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  jumpToIndex?: number;
  jumpKey?: number;
}) {
  const { t } = useI18n();
  const olderCount = totalMessages - messages.length;
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const rowCount = messages.length + (hasPreviousPage ? 1 : 0);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      setScrollMargin(list.offsetTop);
    }
  }, [messages.length, hasPreviousPage]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is intentionally used for transcript virtualization.
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 15,
    scrollMargin,
  });

  const lastJumpKey = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (jumpToIndex === undefined || jumpKey === undefined || jumpKey === lastJumpKey.current) {
      return;
    }
    lastJumpKey.current = jumpKey;
    virtualizer.scrollToIndex(hasPreviousPage ? jumpToIndex + 1 : jumpToIndex, { align: 'start', behavior: 'auto' });
  }, [hasPreviousPage, jumpKey, jumpToIndex, virtualizer]);

  const initialBottomDoneRef = useRef(false);
  useEffect(() => {
    if (initialBottomDoneRef.current || messages.length === 0) {
      return;
    }
    initialBottomDoneRef.current = true;
    virtualizer.scrollToIndex(rowCount - 1, { align: 'end', behavior: 'auto' });
  }, [messages.length, rowCount, virtualizer]);

  return (
    <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
      {virtualizer.getVirtualItems().map((vItem) => {
        const isLoadOlderRow = hasPreviousPage && vItem.index === 0;
        if (isLoadOlderRow) {
          return (
            <div
              key="load-older"
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
                onClick={onLoadOlder}
                disabled={loadingOlder}
                className="w-full py-3 font-mono text-[11px] cursor-pointer transition-colors text-left"
                style={{ color: loadingOlder ? 'var(--dr-dim)' : 'var(--dr-orange)' }}
              >
                {loadingOlder
                  ? t('drawer.timeline.loading')
                  : `↑ ${t('drawer.timeline.moreMessages', { count: olderCount })}`}
              </button>
            </div>
          );
        }

        const msgIndex = hasPreviousPage ? vItem.index - 1 : vItem.index;
        const msg = messages[msgIndex];
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
            <TimelineRow msg={msg} index={msgIndex} isLast={msgIndex === messages.length - 1} />
          </div>
        );
      })}
    </div>
  );
}

function PlainTimeline({
  messages,
  hasPreviousPage,
  totalMessages,
  loadingOlder,
  onLoadOlder,
  jumpToIndex,
  jumpKey,
  scrollRef,
}: {
  messages: Message[];
  hasPreviousPage: boolean;
  totalMessages: number;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  jumpToIndex?: number;
  jumpKey?: number;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useI18n();
  const olderCount = totalMessages - messages.length;

  const lastJumpKey = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (jumpToIndex !== undefined && jumpKey !== undefined && jumpKey !== lastJumpKey.current) {
      lastJumpKey.current = jumpKey;
      const target = scrollRef?.current?.querySelector(`[data-msg-index="${jumpToIndex}"]`);
      target?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [jumpToIndex, jumpKey, scrollRef]);

  const initialBottomDoneRef = useRef(false);
  useEffect(() => {
    const container = scrollRef?.current;
    if (!container || initialBottomDoneRef.current || messages.length === 0) {
      return;
    }
    initialBottomDoneRef.current = true;
    container.scrollTo({ top: container.scrollHeight });
  }, [messages.length, scrollRef]);

  const prevLenRef = useRef(0);
  const prevHeightRef = useRef(0);
  useEffect(() => {
    const container = scrollRef?.current;
    if (!container) {
      return;
    }

    const prepended = messages.length > prevLenRef.current && prevLenRef.current > 0 && hasPreviousPage;
    if (prepended) {
      const delta = container.scrollHeight - prevHeightRef.current;
      container.scrollTo({ top: container.scrollTop + delta });
    }

    prevLenRef.current = messages.length;
    prevHeightRef.current = container.scrollHeight;
  }, [hasPreviousPage, messages.length, scrollRef]);

  return (
    <div className="flex flex-col">
      {hasPreviousPage && olderCount > 0 && (
        <button
          type="button"
          onClick={onLoadOlder}
          disabled={loadingOlder}
          className="py-2 font-mono text-[11px] cursor-pointer transition-colors text-left"
          style={{ color: loadingOlder ? 'var(--dr-dim)' : 'var(--dr-orange)' }}
        >
          {loadingOlder
            ? t('drawer.timeline.loading')
            : `↑ ${t('drawer.timeline.moreMessages', { count: olderCount })}`}
        </button>
      )}

      {messages.length > 0 && (
        <div className="flex items-center gap-1.5 pb-2 font-mono text-[10px]" style={{ color: 'var(--dr-fg2)' }}>
          <span style={{ color: 'var(--dr-dim)' }}>·</span>
          <span>{t('drawer.timeline.sessionStarted')}</span>
          <span style={{ color: 'var(--dr-dim)' }}>·</span>
          <span>{formatTime(messages[0].timestamp)}</span>
        </div>
      )}

      {messages.map((msg, i) => (
        <TimelineRow key={i} msg={msg} index={i} isLast={i === messages.length - 1} />
      ))}
    </div>
  );
}

export function TranscriptTimeline({ state, onLoadOlder, scrollRef, jumpToIndex, jumpKey }: TranscriptTimelineProps) {
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

  const { messages, totalMessages, hasPreviousPage, loadingOlder } = state;
  const effectiveRef = scrollRef ?? fallbackRef;
  const useVirtual = messages.length > VIRTUAL_THRESHOLD && scrollRef !== undefined;

  if (useVirtual) {
    return (
      <>
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
          hasPreviousPage={hasPreviousPage}
          totalMessages={totalMessages}
          loadingOlder={loadingOlder}
          onLoadOlder={onLoadOlder}
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
      hasPreviousPage={hasPreviousPage}
      totalMessages={totalMessages}
      loadingOlder={loadingOlder}
      onLoadOlder={onLoadOlder}
      jumpToIndex={jumpToIndex}
      jumpKey={jumpKey}
      scrollRef={effectiveRef}
    />
  );
}
