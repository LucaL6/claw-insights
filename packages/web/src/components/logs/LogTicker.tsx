import { useEffect, useRef } from 'react';
import type { LogEntry } from './log-utils';
import { formatTickerText } from './log-utils';

const MAX_TICKER_ITEMS = 20;

export function LogTicker({ entries }: { entries: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ticker to the right when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [entries.length]);

  if (entries.length === 0) return null;

  const recent = entries.slice(-MAX_TICKER_ITEMS);

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-3 px-2 py-1 bg-zinc-900/60 border border-zinc-800/60 rounded-md mb-2 overflow-x-auto sb-h whitespace-nowrap"
    >
      <span className="text-[9px] text-zinc-600 flex-shrink-0">SYS</span>
      {recent.map((entry, i) => (
        <span
          key={`${entry.time}-${i}`}
          className="text-[9px] text-zinc-500 flex-shrink-0 flex items-center gap-1"
        >
          <span className="text-zinc-700">{entry.time.slice(0, 8)}</span>
          <span className="text-zinc-500">{formatTickerText(entry)}</span>
          {i < recent.length - 1 && <span className="text-zinc-800 ml-2">·</span>}
        </span>
      ))}
    </div>
  );
}
