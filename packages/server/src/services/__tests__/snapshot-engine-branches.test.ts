import { describe, expect, it, vi } from 'vitest';

import { GatewayUnreachableError } from '../../utils/snapshot-errors.js';
import { SnapshotEngine } from '../snapshot-engine.js';
import type { DataSources, SnapshotRequest } from '../snapshot-types.js';

vi.mock('../../renderer/satori-renderer.js', () => ({
  renderSnapshot: vi.fn().mockResolvedValue(Buffer.alloc(100)),
  renderSnapshotSvg: vi.fn().mockResolvedValue('<svg></svg>'),
}));

vi.mock('../snapshot-service.js', () => ({
  buildSnapshotData: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockSources: DataSources = {} as DataSources;

const defaultParams: SnapshotRequest = {
  layout: 'desktop',
  detail: 'standard',
  format: 'json',
  range: '6h',
  theme: 'dark',
  lang: 'en',
  section: 'dashboard',
};

describe('SnapshotEngine collectData branches', () => {
  it('wraps ECONNREFUSED as GatewayUnreachableError', async () => {
    const { buildSnapshotData } = await import('../snapshot-service.js');
    (buildSnapshotData as any).mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:41040'));

    const engine = new SnapshotEngine(mockSources);
    await expect(engine.execute(defaultParams)).rejects.toThrow(GatewayUnreachableError);
  });

  it('wraps ENOTFOUND as GatewayUnreachableError', async () => {
    const { buildSnapshotData } = await import('../snapshot-service.js');
    (buildSnapshotData as any).mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND localhost'));

    const engine = new SnapshotEngine(mockSources);
    await expect(engine.execute(defaultParams)).rejects.toThrow(GatewayUnreachableError);
  });

  it('rethrows non-network errors as-is', async () => {
    const { buildSnapshotData } = await import('../snapshot-service.js');
    (buildSnapshotData as any).mockRejectedValueOnce(new Error('DB corruption'));

    const engine = new SnapshotEngine(mockSources);
    await expect(engine.execute(defaultParams)).rejects.toThrow('DB corruption');
  });

  it('coalesces inflight requests with same key', async () => {
    const { buildSnapshotData } = await import('../snapshot-service.js');
    let resolveData: (v: unknown) => void;
    const dataPromise = new Promise((r) => {
      resolveData = r;
    });
    (buildSnapshotData as any).mockReturnValue(dataPromise);

    const engine = new SnapshotEngine(mockSources);
    const callsBefore = (buildSnapshotData as any).mock.calls.length;
    const p1 = engine.execute(defaultParams);
    const p2 = engine.execute(defaultParams);

    resolveData!({});
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.format).toBe('json');
    expect(r2.format).toBe('json');
    // buildSnapshotData should have been called only once for both requests
    const callsAfter = (buildSnapshotData as any).mock.calls.length;
    expect(callsAfter - callsBefore).toBe(1);
  });
});
