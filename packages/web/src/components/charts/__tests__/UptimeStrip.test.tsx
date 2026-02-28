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

vi.mock('../builders/buildUptimeOption', () => ({
  buildUptimeOption: vi.fn(() => ({ mockUptimeOption: true })),
}));

import { buildUptimeOption } from '../builders/buildUptimeOption';
import { UptimeStrip } from '../UptimeStrip';

const mockBuildUptimeOption = vi.mocked(buildUptimeOption);

afterEach(cleanup);

const data = [
  { bucket: 1, label: '12:00', gatewayUp: true, restartEvent: false },
  { bucket: 2, label: '13:00', gatewayUp: false, restartEvent: false },
  { bucket: 3, label: '14:00', gatewayUp: true, restartEvent: true },
];

describe('UptimeStrip', () => {
  it('renders without onCellClick (no events)', () => {
    renderWithProviders(<UptimeStrip data={data} />);
    expect(capturedOnEvents).toBeUndefined();
  });

  it('passes data to buildUptimeOption and forwards option to BaseChart', () => {
    renderWithProviders(<UptimeStrip data={data} />);
    expect(mockBuildUptimeOption).toHaveBeenCalledWith(data, expect.any(Object));
    expect(capturedOption).toEqual({ mockUptimeOption: true });
  });

  it('renders with onCellClick and creates click handler', () => {
    const onClick = vi.fn();
    renderWithProviders(<UptimeStrip data={data} onCellClick={onClick} />);
    expect(capturedOnEvents).toEqual({ click: expect.any(Function) });
  });

  it('click on down cell triggers callback', () => {
    const onClick = vi.fn();
    renderWithProviders(<UptimeStrip data={data} onCellClick={onClick} />);
    capturedOnEvents.click({ dataIndex: 1 }); // gatewayUp=false
    expect(onClick).toHaveBeenCalledWith(1);
  });

  it('click on restart cell triggers callback', () => {
    const onClick = vi.fn();
    renderWithProviders(<UptimeStrip data={data} onCellClick={onClick} />);
    capturedOnEvents.click({ dataIndex: 2 }); // restartEvent=true
    expect(onClick).toHaveBeenCalledWith(2);
  });

  it('click on healthy cell does NOT trigger callback', () => {
    const onClick = vi.fn();
    renderWithProviders(<UptimeStrip data={data} onCellClick={onClick} />);
    capturedOnEvents.click({ dataIndex: 0 }); // gatewayUp=true, restartEvent=false
    expect(onClick).not.toHaveBeenCalled();
  });
});
