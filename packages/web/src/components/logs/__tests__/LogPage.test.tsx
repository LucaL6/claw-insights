import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Route } from '../../../hooks/useHashRoute';
import { renderWithProviders } from '../../../test/render';
import { LogPage } from '../LogPage';

const mockUseLogPageData = vi.fn<() => ReturnType<typeof makeData>>();
vi.mock('../../../hooks/useLogPageData', () => ({
  useLogPageData: (...args: Parameters<typeof mockUseLogPageData>) => mockUseLogPageData(...args),
}));

vi.mock('../DensityStrip', () => ({
  DensityStrip: ({ onHourClick }: { onHourClick?: (ts: number) => void }) => (
    <div data-testid="density" onClick={() => onHourClick?.(1000)} />
  ),
}));
vi.mock('../EventTable', () => ({ EventTable: () => <div data-testid="event-table" /> }));
vi.mock('../FilterBar', () => ({
  FilterBar: ({ onClearTimeFilter }: { onClearTimeFilter?: () => void }) => (
    <div data-testid="filter-bar">
      <button data-testid="clear" onClick={onClearTimeFilter}>
        clear
      </button>
    </div>
  ),
}));

afterEach(cleanup);

function makeData(overrides: any = {}) {
  return {
    activeTypes: ['error', 'warning'],
    toggleType: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    processedEvents: [],
    searchError: false,
    density: [],
    counts: { error: 0, warning: 0, restart: 0 },
    events: { total: 0, events: [] },
    timeLabel: '12:00 - 13:00',
    urlFrom: null,
    urlTo: null,
    eventsLoading: false,
    densityLoading: false,
    eventsError: undefined,
    ...overrides,
  };
}

describe('LogPage', () => {
  it('renders title and subcomponents', () => {
    mockUseLogPageData.mockReturnValue(makeData());
    renderWithProviders(<LogPage route={{ page: 'logs', params: {} } as Route} navigate={vi.fn()} />);
    expect(screen.getByTestId('density').tagName).toBe('DIV');
    expect(screen.getByTestId('event-table').tagName).toBe('DIV');
    expect(screen.getByTestId('filter-bar').tagName).toBe('DIV');
  });

  it('passes onClearTimeFilter=undefined when urlFrom is null', () => {
    const nav = vi.fn();
    mockUseLogPageData.mockReturnValue(makeData({ urlFrom: null }));
    renderWithProviders(<LogPage route={{ page: 'logs', params: {} } as Route} navigate={nav} />);
    // clear button exists but clicking it should not navigate (onClearTimeFilter is undefined)
    screen.getByTestId('clear').click();
    expect(nav).not.toHaveBeenCalled();
  });

  it('passes onClearTimeFilter when urlFrom is set', () => {
    const nav = vi.fn();
    mockUseLogPageData.mockReturnValue(makeData({ urlFrom: 1000 }));
    renderWithProviders(<LogPage route={{ page: 'logs', params: {} } as Route} navigate={nav} />);
    screen.getByTestId('clear').click();
    expect(nav).toHaveBeenCalledWith('#logs');
  });

  it('density onHourClick navigates', () => {
    const nav = vi.fn();
    mockUseLogPageData.mockReturnValue(makeData({ activeTypes: ['error'] }));
    renderWithProviders(<LogPage route={{ page: 'logs', params: {} } as Route} navigate={nav} />);
    screen.getByTestId('density').click();
    expect(nav).toHaveBeenCalledWith('#logs?from=1000&to=4600&type=error');
  });

  it('handles null events gracefully', () => {
    mockUseLogPageData.mockReturnValue(makeData({ events: null }));
    renderWithProviders(<LogPage route={{ page: 'logs', params: {} } as Route} navigate={vi.fn()} />);
    expect(screen.getByTestId('filter-bar').tagName).toBe('DIV');
  });
});
