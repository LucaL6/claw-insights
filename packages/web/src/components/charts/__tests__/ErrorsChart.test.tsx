import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';

let capturedOnEvents: any;
let capturedOption: any;
vi.mock('../core/BaseChart', () => ({
  BaseChart: ({ onEvents, testId, option }: any) => {
    capturedOnEvents = onEvents;
    capturedOption = option;
    return <div data-testid={testId} />;
  },
}));

vi.mock('../builders/buildErrorsOption', () => ({
  buildErrorsOption: vi.fn(() => ({ mockOption: true })),
}));

import { buildErrorsOption } from '../builders/buildErrorsOption';
import { ErrorsChart } from '../ErrorsChart';

const mockBuildErrorsOption = vi.mocked(buildErrorsOption);

afterEach(cleanup);

const data = [{ bucket: 1, label: '12:00', errors: 2, warnings: 1, restartEvent: false }];

describe('ErrorsChart', () => {
  it('renders without onBucketClick', () => {
    renderWithProviders(<ErrorsChart data={data} />);
    expect(capturedOnEvents).toBeUndefined();
  });

  it('passes data to buildErrorsOption and forwards option to BaseChart', () => {
    renderWithProviders(<ErrorsChart data={data} />);
    expect(mockBuildErrorsOption).toHaveBeenCalledWith(data, expect.any(String), expect.any(Object));
    expect(capturedOption).toEqual({ mockOption: true });
  });

  it('renders with onBucketClick and creates click handler', () => {
    const onClick = vi.fn();
    renderWithProviders(<ErrorsChart data={data} onBucketClick={onClick} />);
    expect(capturedOnEvents).toEqual({ click: expect.any(Function) });
  });

  it('click on error series triggers callback', () => {
    const onClick = vi.fn();
    renderWithProviders(<ErrorsChart data={data} onBucketClick={onClick} />);
    capturedOnEvents.click({ dataIndex: 0, seriesName: 'Errors' });
    expect(onClick).toHaveBeenCalledWith(0);
  });

  it('click on Restart series does NOT trigger callback', () => {
    const onClick = vi.fn();
    renderWithProviders(<ErrorsChart data={data} onBucketClick={onClick} />);
    capturedOnEvents.click({ dataIndex: 0, seriesName: 'Restart' });
    expect(onClick).not.toHaveBeenCalled();
  });
});
