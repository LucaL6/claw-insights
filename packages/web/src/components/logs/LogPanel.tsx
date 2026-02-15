import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
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

  // Unique modules from entries
  const modules = useMemo(() => {
    const set = new Set(entries.map(e => e.module));
    return Array.from(set).sort();
  }, [entries]);

  // Filtered entries
  const filtered = useMemo(() => {
    let result = entries;
    if (moduleFilter) result = result.filter(e => e.module === moduleFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => e.message.toLowerCase().includes(q));
    }
    return result;
  }, [entries, moduleFilter, searchQuery]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  return (
    <CollapsibleSection title={
      <span className="flex items-center gap-2">
        Live Logs
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
      </span>
    } badge={entries.length}>
      {/* Filters */}
      <div className="flex items-center justify-between mb-2 text-[10px]">
        {/* Left: level filters */}
        <div className="flex items-center gap-1.5">
          {(['ERROR', 'WARN', 'ALL'] as const).map((lvl) => {
            const isAll = lvl === 'ALL';
            const count = isAll ? null : counts[lvl as keyof typeof counts];
            const isSelected = isAll ? !levelFilter : levelFilter === lvl;
            const colorMap: Record<string, string> = {
              ERROR: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
              WARN: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
              ALL: 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700',
            };
            return (
              <button
                key={lvl}
                onClick={() => setLevelFilter(isAll ? null : lvl)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  isSelected ? colorMap[lvl] : 'border-zinc-800 text-zinc-600 bg-transparent'
                }`}
              >
                {lvl}{count !== null && count > 0 ? ` ${count}` : ''}
              </button>
            );
          })}
        </div>

        {/* Right: module dropdown + search */}
        <div className="flex items-center gap-1.5">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded px-1.5 py-0.5 outline-none"
          >
            <option value="">All Modules</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="px-2 py-0.5 text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700 rounded hover:bg-zinc-700 transition-colors"
          >
            🔍
          </button>
          <button
            onClick={() => { setEntries([]); setCounts({ ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 }); }}
            className="px-2 py-0.5 rounded border border-zinc-800 text-zinc-600 hover:text-zinc-400"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search bar (conditional) */}
      {showSearch && (
        <div className="mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search log messages..."
            className="w-full text-[10px] bg-zinc-900 border border-zinc-700 text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-700"
          />
        </div>
      )}

      {/* Log stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-zinc-900 border border-zinc-800 rounded-lg h-60 overflow-y-auto sb"
      >
        {filtered.map((e, i) => (
          <LogEntryRow key={i} {...e} />
        ))}
        {filtered.length === 0 && (
          <p className="text-zinc-600 text-xs p-4 text-center">
            {entries.length > 0 ? 'No logs match filters' : 'Waiting for logs...'}
          </p>
        )}
      </div>

      {autoScroll && entries.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-600">
          <span className="w-1.5 h-3.5 bg-emerald-400/60 pulse-dot rounded-sm" />
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
