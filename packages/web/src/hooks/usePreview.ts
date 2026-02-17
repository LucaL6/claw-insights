import { useState } from 'react';
import { useQuery } from 'urql';
import { EventsQuery } from '../graphql/events-queries';
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

  const handleErrorClick = (idx: number) => {
    const b = buckets[idx];
    if (!b?.epochStart) return;
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
    if (!b?.epochStart) return;
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

  const [previewResult] = useQuery({
    query: EventsQuery,
    variables: preview
      ? { from: preview.fromTs, to: preview.toTs, types: preview.types, limit: 3 }
      : { limit: 0 },
    pause: !preview,
  });

  return {
    preview,
    previewEvents: previewResult.data?.events,
    handleErrorClick,
    handleUptimeClick,
    closePreview: () => setPreview(null),
  };
}
