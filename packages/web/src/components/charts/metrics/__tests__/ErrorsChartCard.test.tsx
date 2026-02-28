import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import { ErrorsChartCard } from '../ErrorsChartCard';

vi.mock('../../ErrorsChart', () => ({
  ErrorsChart: ({ onBucketClick }: { onBucketClick?: (i: number) => void }) => (
    <div data-testid="errors-chart" onClick={() => onBucketClick?.(0)} />
  ),
}));
vi.mock('../PreviewCard', () => ({
  PreviewCard: ({ onClose, onNavigate }: { onClose: () => void; onNavigate: (h: string) => void }) => (
    <div data-testid="preview-card">
      <button onClick={onClose}>close</button>
      <button onClick={() => onNavigate('#test')}>nav</button>
    </div>
  ),
}));

afterEach(cleanup);

const bucket = {
  bucket: 1,
  label: '12:00',
  errors: 2,
  warnings: 1,
  restartEvent: false,
  gatewayUp: true,
  fromTs: 1000,
  toTs: 2000,
};

describe('ErrorsChartCard', () => {
  it('renders error count and legend', () => {
    renderWithProviders(
      <ErrorsChartCard
        buckets={[bucket] as any}
        totalErrors={5}
        rangeLabel="24h"
        preview={null}
        previewEvents={undefined}
        onBucketClick={vi.fn()}
        onClosePreview={vi.fn()}
      />,
    );
    expect(screen.getByTestId('errors-chart')).toBeDefined();
  });

  it('does not show preview when preview is null', () => {
    renderWithProviders(
      <ErrorsChartCard
        buckets={[bucket] as any}
        totalErrors={0}
        rangeLabel="1h"
        preview={null}
        previewEvents={undefined}
        onBucketClick={vi.fn()}
        onClosePreview={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('preview-card')).toBeNull();
  });

  it('shows preview when source is errors and navigate provided', () => {
    renderWithProviders(
      <ErrorsChartCard
        buckets={[bucket] as any}
        totalErrors={2}
        rangeLabel="24h"
        preview={{ source: 'errors', bucketIndex: 0, fromTs: 1000, toTs: 2000, types: ['error'] }}
        previewEvents={{ events: [], total: 0 }}
        onBucketClick={vi.fn()}
        onClosePreview={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    expect(screen.getByTestId('preview-card')).toBeDefined();
  });

  it('does not show preview when source is uptime', () => {
    renderWithProviders(
      <ErrorsChartCard
        buckets={[bucket] as any}
        totalErrors={2}
        rangeLabel="24h"
        preview={{ source: 'uptime', bucketIndex: 0, fromTs: 1000, toTs: 2000, types: ['error'] }}
        previewEvents={{ events: [], total: 0 }}
        onBucketClick={vi.fn()}
        onClosePreview={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('preview-card')).toBeNull();
  });

  it('does not show preview when navigate is undefined', () => {
    renderWithProviders(
      <ErrorsChartCard
        buckets={[bucket] as any}
        totalErrors={2}
        rangeLabel="24h"
        preview={{ source: 'errors', bucketIndex: 0, fromTs: 1000, toTs: 2000, types: ['error'] }}
        previewEvents={{ events: [], total: 0 }}
        onBucketClick={vi.fn()}
        onClosePreview={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('preview-card')).toBeNull();
  });

  it('does not show preview when previewEvents is undefined', () => {
    renderWithProviders(
      <ErrorsChartCard
        buckets={[bucket] as any}
        totalErrors={2}
        rangeLabel="24h"
        preview={{ source: 'errors', bucketIndex: 0, fromTs: 1000, toTs: 2000, types: ['error'] }}
        previewEvents={undefined}
        onBucketClick={vi.fn()}
        onClosePreview={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('preview-card')).toBeNull();
  });
});
