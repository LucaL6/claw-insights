import { useState, useRef, useEffect, useCallback } from 'react';
import { useSubscription } from 'urql';
import { LogsSubscription } from '../../graphql/subscriptions';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { LogEntryRow } from './LogEntry';

interface LogEntry {
  time: string;
  level: string;
  module: string;
  message: string;
}

const MAX_ENTRIES = 500;

export function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [counts, setCounts] = useState({ ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 });
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubscription = useCallback((_prev: unknown, data: { logs: { entries: LogEntry[] } }) => {
    if (data?.logs?.entries) {
      setEntries((prev) => {
        const next = [...prev, ...data.logs.entries];
        return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
      });
      setCounts((prev) => {
        const updated = { ...prev };
        for (const e of data.logs.entries) {
          if (e.level in updated) updated[e.level as keyof typeof updated]++;
        }
        return updated;
      });
    }
    return data;
  }, []);

  useSubscription(
    {
      query: LogsSubscription,
      variables: { filter: levelFilter ? { level: levelFilter } : {} },
    },
    handleSubscription,
  );

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  return (
    <CollapsibleSection title={
      <span className="flex items-center gap-2">
        Live Logs
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </span>
    } badge={entries.length}>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-2 text-[10px]">
        {['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map((lvl) => {
          const count = lvl === 'ALL' ? null : counts[lvl as keyof typeof counts];
          return (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl === 'ALL' ? null : lvl)}
              className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                (lvl === 'ALL' && !levelFilter) || levelFilter === lvl
                  ? 'border-cyan-700 text-cyan-400 bg-cyan-950/30'
                  : 'border-zinc-800 text-zinc-600'
              }`}
            >
              {lvl}
              {count !== null && count > 0 && (
                <span className={`text-[9px] px-1 rounded ${
                  lvl === 'ERROR' ? 'bg-red-900/50 text-red-400' :
                  lvl === 'WARN' ? 'bg-amber-900/50 text-amber-400' :
                  'bg-zinc-800 text-zinc-500'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => { setEntries([]); setCounts({ ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 }); }}
          className="ml-auto px-2 py-0.5 rounded border border-zinc-800 text-zinc-600 hover:text-zinc-400"
        >
          Clear
        </button>
      </div>

      {/* Log stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-zinc-900 border border-zinc-800 rounded-lg h-60 overflow-y-auto scrollbar-thin"
      >
        {entries.map((e, i) => (
          <LogEntryRow key={i} {...e} />
        ))}
        {entries.length === 0 && (
          <p className="text-zinc-600 text-xs p-4 text-center">Waiting for logs...</p>
        )}
      </div>

      {autoScroll && entries.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-600">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-sm animate-pulse" />
          streaming...
        </div>
      )}

      {!autoScroll && (
        <button
          onClick={() => setAutoScroll(true)}
          className="mt-1 text-[10px] text-cyan-600 hover:text-cyan-400"
        >
          ↓ Resume auto-scroll
        </button>
      )}
    </CollapsibleSection>
  );
}
