import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import { UptimeChartCard } from '../UptimeChartCard';

vi.mock('../../UptimeStrip', () => ({ UptimeStrip: () => <div data-testid="uptime-strip" /> }));
vi.mock('../PreviewCard', () => ({ PreviewCard: () => <div data-testid="preview-card" /> }));

afterEach(cleanup);

const bucket = { bucket: 1, label: '12:00', gatewayUp: true, restartEvent: false };

describe('UptimeChartCard', () => {
  it('renders uptime percentage', () => {
    renderWithProviders(
      <UptimeChartCard
        buckets={[bucket] as any}
        uptimePct={99.5}
        preview={null}
        previewEvents={undefined}
        onCellClick={vi.fn()}
        onClosePreview={vi.fn()}
      />,
    );
    expect(screen.getByText('99.5%')).toBeDefined();
    expect(screen.getByTestId('uptime-strip')).toBeDefined();
  });

  it('does not show preview when null', () => {
    renderWithProviders(
      <UptimeChartCard
        buckets={[bucket] as any}
        uptimePct={100}
        preview={null}
        previewEvents={undefined}
        onCellClick={vi.fn()}
        onClosePreview={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('preview-card')).toBeNull();
  });

  it('shows preview when source=uptime and navigate provided', () => {
    renderWithProviders(
      <UptimeChartCard
        buckets={[bucket] as any}
        uptimePct={95}
        preview={{ source: 'uptime', bucketIndex: 0, fromTs: 1000, toTs: 2000, types: ['gateway_restart'] }}
        previewEvents={{ events: [], total: 0 }}
        onCellClick={vi.fn()}
        onClosePreview={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    expect(screen.getByTestId('preview-card')).toBeDefined();
  });

  it('does not show preview when source=errors', () => {
    renderWithProviders(
      <UptimeChartCard
        buckets={[bucket] as any}
        uptimePct={95}
        preview={{ source: 'errors', bucketIndex: 0, fromTs: 1000, toTs: 2000, types: ['error'] }}
        previewEvents={{ events: [], total: 0 }}
        onCellClick={vi.fn()}
        onClosePreview={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('preview-card')).toBeNull();
  });

  it('does not show preview without navigate', () => {
    renderWithProviders(
      <UptimeChartCard
        buckets={[bucket] as any}
        uptimePct={95}
        preview={{ source: 'uptime', bucketIndex: 0, fromTs: 1000, toTs: 2000, types: ['gateway_restart'] }}
        previewEvents={{ events: [], total: 0 }}
        onCellClick={vi.fn()}
        onClosePreview={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('preview-card')).toBeNull();
  });

  it('does not show preview without previewEvents', () => {
    renderWithProviders(
      <UptimeChartCard
        buckets={[bucket] as any}
        uptimePct={95}
        preview={{ source: 'uptime', bucketIndex: 0, fromTs: 1000, toTs: 2000, types: ['gateway_restart'] }}
        previewEvents={undefined}
        onCellClick={vi.fn()}
        onClosePreview={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('preview-card')).toBeNull();
  });
});
