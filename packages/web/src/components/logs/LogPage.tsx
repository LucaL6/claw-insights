import { useState, useMemo, useCallback } from 'react';
import { useQuery } from 'urql';
import { EventsQuery, EventDensityQuery } from '../../graphql/events-queries';
import { DensityStrip } from './DensityStrip';
import { FilterBar } from './FilterBar';
import { EventTable } from './EventTable';
import { useI18n } from '../../i18n/context';
import type { Route } from '../../hooks/useHashRoute';

interface Props {
  route: Route;
  navigate: (hash: string) => void;
}

const ALL_TYPES = ['error', 'warning', 'gateway_restart'];

export function LogPage({ route, navigate }: Props) {
  const { t } = useI18n();

  // Parse URL params
  const urlFrom = route.params.from ? Number(route.params.from) : undefined;
  const urlTo = route.params.to ? Number(route.params.to) : undefined;
  const urlTypes = route.params.type ? route.params.type.split(',') : undefined;

  // State
  const [activeTypes, setActiveTypes] = useState<string[]>(urlTypes ?? ALL_TYPES);
  const [search, setSearch] = useState('');

  // Time range: from URL or default 24h
  const defaultFrom = Math.floor(Date.now() / 1000) - 86400;
  const fromTs = urlFrom ?? defaultFrom;
  const toTs = urlTo; // undefined = no upper bound

  // Queries
  const [eventsResult] = useQuery({
    query: EventsQuery,
    variables: { from: fromTs, to: toTs, types: activeTypes, limit: 200 },
  });

  const [densityResult] = useQuery({ query: EventDensityQuery });

  const eventsLoading = eventsResult.fetching && !eventsResult.data;
  const densityLoading = densityResult.fetching && !densityResult.data;

  const events = eventsResult.data?.events;
  const density = densityResult.data?.eventDensity ?? [];

  // Toggle type filter
  const toggleType = useCallback((type: string) => {
    setActiveTypes(prev => {
      const next = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type];
      // Update URL
      const params = new URLSearchParams();
      if (urlFrom) params.set('from', String(urlFrom));
      if (urlTo) params.set('to', String(urlTo));
      if (next.length < ALL_TYPES.length) params.set('type', next.join(','));
      const qs = params.toString();
      window.history.replaceState(null, '', `#logs${qs ? '?' + qs : ''}`);
      return next.length > 0 ? next : prev; // prevent empty selection
    });
  }, [urlFrom, urlTo]);

  // Client-side search filter
  const filteredEvents = useMemo(() => {
    if (!events?.events) return [];
    if (!search) return events.events;
    const q = search.toLowerCase();
    return events.events.filter((e: { message: string; module: string }) =>
      e.message.toLowerCase().includes(q) || e.module.toLowerCase().includes(q)
    );
  }, [events, search]);

  // Time label for filter bar
  const timeLabel = useMemo(() => {
    if (!urlFrom || !urlTo) return undefined;
    const f = new Date(urlFrom * 1000);
    const t = new Date(urlTo * 1000);
    const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fmt(f)} → ${fmt(t)}`;
  }, [urlFrom, urlTo]);

  return (
    <div className="p-4 max-w-full">
      <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        {t('logs.title')}
      </h2>

      {/* Density strip */}
      <DensityStrip
        data={density}
        activeHour={urlFrom}
        loading={densityLoading}
        onHourClick={(epochStart) => {
          navigate(`#logs?from=${epochStart}&to=${epochStart + 3600}&type=${activeTypes.join(',')}`);
        }}
      />

      {/* Filter bar */}
      <FilterBar
        activeTypes={activeTypes}
        onToggleType={toggleType}
        counts={events?.counts ?? { error: 0, warning: 0, restart: 0 }}
        total={events?.total ?? 0}
        displayed={events?.events?.length ?? 0}
        filtered={filteredEvents.length}
        search={search}
        onSearchChange={setSearch}
        timeLabel={timeLabel}
        onClearTimeFilter={urlFrom ? () => navigate('#logs') : undefined}
      />

      {/* Event table */}
      <EventTable
        events={filteredEvents}
        highlightFrom={urlFrom}
        highlightTo={urlTo}
        search={search}
        loading={eventsLoading}
        error={eventsResult.error?.message}
      />
    </div>
  );
}
