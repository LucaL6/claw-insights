import { useState, useMemo, useCallback } from 'react';
import { useQuery } from 'urql';
import { EventsQuery, EventDensityQuery } from '../graphql/events-queries';
import type { Route } from './useHashRoute';

const ALL_TYPES = ['error', 'warning', 'gateway_restart'];

export function useLogPageData(route: Route) {
  // Parse URL params
  const urlFrom = route.params.from ? Number(route.params.from) : undefined;
  const urlTo = route.params.to ? Number(route.params.to) : undefined;
  const urlTypes = route.params.type ? route.params.type.split(',') : undefined;

  // State
  const [activeTypes, setActiveTypes] = useState<string[]>(urlTypes ?? ALL_TYPES);
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

  const events = eventsResult.data?.events;
  const density = densityResult.data?.eventDensity ?? [];

  // Toggle type filter
  const toggleType = useCallback(
    (type: string) => {
      setActiveTypes((prev) => {
        const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
        const params = new URLSearchParams();
        if (urlFrom) params.set('from', String(urlFrom));
        if (urlTo) params.set('to', String(urlTo));
        if (next.length < ALL_TYPES.length) params.set('type', next.join(','));
        const qs = params.toString();
        window.history.replaceState(null, '', `#logs${qs ? '?' + qs : ''}`);
        return next.length > 0 ? next : prev;
      });
    },
    [urlFrom, urlTo],
  );

  // Client-side search filter
  const filteredEvents = useMemo(() => {
    if (!events?.events) return [];
    if (!search) return events.events;
    const q = search.toLowerCase();
    return events.events.filter(
      (e: { message: string; module: string }) =>
        e.message.toLowerCase().includes(q) || e.module.toLowerCase().includes(q),
    );
  }, [events, search]);

  // Time label
  const timeLabel = useMemo(() => {
    if (!urlFrom || !urlTo) return undefined;
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
    filteredEvents,
    density,
    events,
    timeLabel,
    urlFrom,
    urlTo,
    eventsLoading: eventsResult.fetching && !eventsResult.data,
    densityLoading: densityResult.fetching && !densityResult.data,
    eventsError: eventsResult.error?.message,
  };
}
