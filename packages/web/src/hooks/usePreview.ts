import { useState } from 'react';
import { useQuery } from 'urql';

import type { EventsQuery as EventsQueryData, EventsQueryVariables } from '../generated/graphql';
import { EventsQuery } from '../graphql/queries';
import { getDashboardSourceSelector } from '../graphql/source-selector';
import type { BucketData } from './useMetricsData';

interface PreviewState {
  source: 'errors' | 'uptime';
  bucketIndex: number;
  fromTs: number;
  toTs: number;
  types: string[];
}

export function usePreview(buckets: BucketData[], bucketSeconds: number) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const selector = getDashboardSourceSelector();

  const handleErrorClick = (idx: number) => {
    const b = buckets[idx];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- guard out-of-bounds index
    if (!b?.epochStart) {
      return;
    }
    if (preview?.bucketIndex === idx && preview.source === 'errors') {
      setPreview(null);
      return;
    }
    setPreview({
      source: 'errors',
      bucketIndex: idx,
      fromTs: b.epochStart,
      toTs: b.epochStart + bucketSeconds,
      types: ['error', 'warning'],
    });
  };

  const handleUptimeClick = (idx: number) => {
    const b = buckets[idx];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- guard out-of-bounds index
    if (!b?.epochStart) {
      return;
    }
    if (preview?.bucketIndex === idx && preview.source === 'uptime') {
      setPreview(null);
      return;
    }
    setPreview({
      source: 'uptime',
      bucketIndex: idx,
      fromTs: b.epochStart,
      toTs: b.epochStart + bucketSeconds,
      types: ['gateway_restart'],
    });
  };

  const [previewResult] = useQuery<EventsQueryData, EventsQueryVariables>({
    query: EventsQuery,
    variables: preview
      ? { selector, from: preview.fromTs, to: preview.toTs, types: preview.types, limit: 3 }
      : { selector, limit: 0 },
    pause: !preview,
  });

  const previewSource = previewResult.data?.source;
  const previewEvents = previewSource && 'events' in previewSource ? previewSource.events : undefined;

  return {
    preview,
    previewEvents,
    handleErrorClick,
    handleUptimeClick,
    closePreview: () => {
      setPreview(null);
    },
  };
}
