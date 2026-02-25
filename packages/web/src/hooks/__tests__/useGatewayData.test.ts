import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const queryResults: Record<string, [unknown]> = {};

vi.mock('../../graphql/queries', () => ({
  GatewayQuery: 'GatewayQuery',
  ResourcesQuery: 'ResourcesQuery',
  ChannelsQuery: 'ChannelsQuery',
}));

vi.mock('../../utils/format', () => ({
  formatUptime: (v: string | undefined) => (v ? 'some uptime' : ''),
}));

vi.mock('../useReactiveQuery', () => ({
  useReactiveQuery: (opts: { query: unknown }) => {
    const key = String(opts.query).slice(0, 40);
    for (const [k, v] of Object.entries(queryResults)) {
      if (key.includes(k)) return v;
    }
    return [{ data: undefined, fetching: false }];
  },
}));

import { useGatewayData } from '../useGatewayData';

describe('useGatewayData', () => {
  it('returns status=running when gateway.running is true', () => {
    queryResults['Gateway'] = [
      { data: { gateway: { running: true, startedAt: '2025-02-22T00:00:00Z' } }, fetching: false },
    ];
    queryResults['Resources'] = [{ data: { resources: { cpu: 2.1, memoryMB: 85 } }, fetching: false }];
    queryResults['Channels'] = [
      {
        data: { channels: [{ provider: 'telegram', name: 'Telegram', connected: true, latencyMs: 12 }] },
        fetching: false,
      },
    ];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('running');
    expect(result.current.resources).toEqual({ cpu: 2.1, memoryMB: 85 });
    expect(result.current.channels).toHaveLength(1);
    expect(result.current.uptime).toBeDefined();
  });

  it('returns status=down when gateway.running is false', () => {
    queryResults['Gateway'] = [{ data: { gateway: { running: false } }, fetching: false }];
    queryResults['Resources'] = [{ data: undefined, fetching: false }];
    queryResults['Channels'] = [{ data: { channels: [] }, fetching: false }];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('down');
  });

  it('returns status=connecting when gateway is fetching with no data', () => {
    queryResults['Gateway'] = [{ data: undefined, fetching: true }];
    queryResults['Resources'] = [{ data: undefined, fetching: true }];
    queryResults['Channels'] = [{ data: undefined, fetching: true }];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('connecting');
  });

  it('returns status=down when fetch completes with no data (error case)', () => {
    queryResults['Gateway'] = [{ data: undefined, fetching: false }];
    queryResults['Resources'] = [{ data: undefined, fetching: false }];
    queryResults['Channels'] = [{ data: undefined, fetching: false }];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('down');
    expect(result.current.channels).toEqual([]);
  });
});
