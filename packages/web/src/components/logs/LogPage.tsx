import { DensityStrip } from './DensityStrip';
import { FilterBar } from './FilterBar';
import { EventTable } from './EventTable';
import { useI18n } from '../../i18n/context';
import { useLogPageData } from '../../hooks/useLogPageData';
import type { Route } from '../../hooks/useHashRoute';

interface Props {
  route: Route;
  navigate: (hash: string) => void;
}

export function LogPage({ route, navigate }: Props) {
  const { t } = useI18n();
  const {
    activeTypes, toggleType, search, setSearch,
    filteredEvents, density, events, timeLabel,
    urlFrom, urlTo,
    eventsLoading, densityLoading, eventsError,
  } = useLogPageData(route);

  return (
    <div className="p-4 max-w-full">
      <h2 className="text-[14px] font-semibold mb-3 text-fg">{t('logs.title')}</h2>

      <DensityStrip
        data={density}
        activeHour={urlFrom}
        loading={densityLoading}
        onHourClick={(epochStart) => {
          navigate(`#logs?from=${epochStart}&to=${epochStart + 3600}&type=${activeTypes.join(',')}`);
        }}
      />

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

      <EventTable
        events={filteredEvents}
        highlightFrom={urlFrom}
        highlightTo={urlTo}
        search={search}
        loading={eventsLoading}
        error={eventsError}
      />
    </div>
  );
}
