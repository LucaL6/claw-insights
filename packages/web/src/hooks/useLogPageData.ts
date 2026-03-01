import { useCallback, useMemo, useState } from 'react';
import { useQuery } from 'urql';

import type { ProcessedEvent } from '../components/logs/EventRow';
import { EventCountsQuery, EventDensityQuery, EventsQuery } from '../graphql/events-queries';
import type { Route } from './useHashRoute';
import { useHashRoute } from './useHashRoute';

const ALL_TYPES = ['error', 'warning', 'gateway_restart'];

// --- Search parser ---

interface ParsedSearch {
  module?: string;
  regex?: RegExp | null;
  regexError?: boolean;
  text?: string;
}

export function parseSearch(input: string): ParsedSearch {
  const trimmed = input.trim();
  if (!trimmed) {
    return {};
  }

  let module: string | undefined;
  let remaining = trimmed;

  const moduleMatch = remaining.match(/^module:(\S+)\s*/);
  if (moduleMatch) {
    module = moduleMatch[1];
    remaining = remaining.slice(moduleMatch[0].length);
  }

  if (!remaining) {
    return { module };
  }

  const regexMatch = remaining.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexMatch) {
    if (regexMatch[1].length > 200) {
      // Too long — fallback to plain text search (including slashes)
      return { module, regexError: true, text: remaining.toLowerCase() };
    }
    try {
      // Strip global/sticky flags to avoid lastIndex mutation across rows
      const safeFlags = regexMatch[2].replace(/[gy]/g, '');
      return { module, regex: new RegExp(regexMatch[1], safeFlags) };
    } catch {
      // Invalid regex — fallback to plain text search (including slashes)
      return { module, regexError: true, text: remaining.toLowerCase() };
    }
  }

  return { module, text: remaining.toLowerCase() };
}

// --- Event processing (gap detection + repeat grouping) ---

interface RawEvent {
  timestamp: string;
  type: string;
  module: string;
  message: string;
}

export function processEvents(events: RawEvent[]): ProcessedEvent[] {
  const result: ProcessedEvent[] = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const prev = result[result.length - 1];

    // Gap detection (reverse-chrono: prev.timestamp > ev.timestamp)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- prev can be undefined on first iteration
    if (prev) {
      const gap =
        (new Date(prev.gapBefore ? prev.timestamp : (prev.repeatFirst ?? prev.timestamp)).getTime() -
          new Date(ev.timestamp).getTime()) /
        1000;
      if (gap >= 300) {
        result.push({ ...ev, gapBefore: gap });
        continue;
      }
    }

    // Repeat grouping (consecutive same module+message, no gap on prev)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- prev can be undefined
    if (prev && !prev.gapBefore && prev.module === ev.module && prev.message === ev.message) {
      prev.repeatCount = (prev.repeatCount ?? 1) + 1;
      prev.repeatFirst = ev.timestamp;
      continue;
    }

    result.push({ ...ev });
  }
  return result;
}

// --- Hook ---

export function useLogPageData(route: Route) {
  const { navigate } = useHashRoute();

  // Parse URL params
  const urlFrom = route.params.from ? Number(route.params.from) : undefined;
  const urlTo = route.params.to ? Number(route.params.to) : undefined;

  // Derive activeTypes from route params (no useState)
  const activeTypes = useMemo(() => {
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- type can be undefined at runtime despite index signature */
    const urlTypes = route.params.type?.split(',').filter(Boolean);
    return urlTypes && urlTypes.length > 0 ? urlTypes : ALL_TYPES;
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */
  }, [route.params.type]);

  // State
  const [search, setSearch] = useState('');

  // Time range
  const [defaultFrom] = useState(() => Math.floor(Date.now() / 1000) - 86400);
  const fromTs = urlFrom ?? defaultFrom;
  const toTs = urlTo;

  // Queries
  const [eventsResult] = useQuery({
    query: EventsQuery,
    variables: { from: fromTs, to: toTs, types: activeTypes, limit: 200 },
  });
  const [densityResult] = useQuery({ query: EventDensityQuery });
  const [countsResult] = useQuery({
    query: EventCountsQuery,
    variables: { from: fromTs, to: toTs },
    requestPolicy: 'cache-and-network',
  });

  const events = eventsResult.data?.events;
  const density = densityResult.data?.eventDensity ?? [];

  // Toggle type filter
  const toggleType = useCallback(
    (type: string) => {
      const next = activeTypes.includes(type) ? activeTypes.filter((t) => t !== type) : [...activeTypes, type];
      if (next.length === 0) {
        return;
      }
      const params = new URLSearchParams();
      if (urlFrom) {
        params.set('from', String(urlFrom));
      }
      if (urlTo) {
        params.set('to', String(urlTo));
      }
      if (next.length < ALL_TYPES.length) {
        params.set('type', next.join(','));
      }
      const qs = params.toString();
      navigate(`#logs${qs ? '?' + qs : ''}`);
    },
    [activeTypes, urlFrom, urlTo, navigate],
  );

  // Client-side search + processing
  const parsed = useMemo(() => parseSearch(search), [search]);

  const processedEvents = useMemo(() => {
    if (!events?.events) {
      return [];
    }

    let filtered = events.events as RawEvent[];
    if (parsed.module) {
      const mod = parsed.module;
      filtered = filtered.filter((e) => e.module === mod);
    }
    if (parsed.regex) {
      const re = parsed.regex;
      filtered = filtered.filter((e) => re.test(e.message) || re.test(e.module));
    } else if (parsed.text) {
      const t = parsed.text;
      filtered = filtered.filter((e) => e.message.toLowerCase().includes(t) || e.module.toLowerCase().includes(t));
    }

    return processEvents(filtered);
  }, [events, parsed]);

  // Time label
  const timeLabel = useMemo(() => {
    if (!urlFrom || !urlTo) {
      return undefined;
    }
    const f = new Date(urlFrom * 1000);
    const t = new Date(urlTo * 1000);
    const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fmt(f)} → ${fmt(t)}`;
  }, [urlFrom, urlTo]);

  return {
    activeTypes,
    toggleType,
    search,
    setSearch,
    processedEvents,
    searchError: parsed.regexError,
    density,
    counts: countsResult.data?.eventCounts ?? { error: 0, warning: 0, restart: 0 },
    events,
    timeLabel,
    urlFrom,
    urlTo,
    eventsLoading: eventsResult.fetching && !eventsResult.data,
    densityLoading: densityResult.fetching && !densityResult.data,
    eventsError: eventsResult.error?.message,
  };
}
