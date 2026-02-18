import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/snapshot-types.js', () => ({
  parseSnapshotRequest: vi.fn(),
  RANGE_MAP: { '1h': 'ONE_HOUR', '6h': 'SIX_HOUR', '12h': 'TWELVE_HOUR', '24h': 'TWENTY_FOUR_HOUR' },
}));

vi.mock('../../services/snapshot-service.js', () => ({
  buildSnapshotData: vi.fn(async () => ({ gateway: {}, sessions: [] })),
}));

vi.mock('../../services/snapshot-template/index.js', () => ({
  renderSnapshot: vi.fn(() => '<html></html>'),
  VIEWPORT_WIDTH: { compact: 400, standard: 800, full: 1200 },
}));

vi.mock('../../browser/capture.js', () => ({
  capture: vi.fn(async () => Buffer.from('png-desktop')),
  captureFromHtml: vi.fn(async () => Buffer.from('png-mobile')),
}));

vi.mock('../../config.js', () => ({
  config: { webPort: 3000, cliPath: '/usr/bin/openclaw' },
  CLI_ENV: {},
}));

import { createSnapshotHandler } from '../snapshot-handler';
import { parseSnapshotRequest } from '../../services/snapshot-types';

function mockRes() {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn(), set: vi.fn(), send: vi.fn() };
  return res;
}

describe('createSnapshotHandler', () => {
  const pool: any = { canCapture: vi.fn(() => true), beginCapture: vi.fn(), endCapture: vi.fn() };
  const sources: any = {};

  beforeEach(() => {
    vi.clearAllMocks();
    pool.canCapture.mockReturnValue(true);
  });

  it('returns 400 on invalid request', async () => {
    (parseSnapshotRequest as any).mockImplementation(() => { throw new Error('bad input'); });
    const handler = createSnapshotHandler(pool, sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'bad input' });
  });

  it('returns JSON for json format', async () => {
    (parseSnapshotRequest as any).mockReturnValue({ format: 'json', range: '1h', detail: 'standard' });
    const handler = createSnapshotHandler(pool, sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.json).toHaveBeenCalledWith(expect.any(Object));
  });

  it('returns 503 when pool is full', async () => {
    pool.canCapture.mockReturnValue(false);
    (parseSnapshotRequest as any).mockReturnValue({ format: 'png', range: '1h', layout: 'desktop', detail: 'standard', theme: 'dark', lang: 'en', section: 'dashboard' });
    const handler = createSnapshotHandler(pool, sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('captures mobile screenshot via captureFromHtml', async () => {
    (parseSnapshotRequest as any).mockReturnValue({ format: 'png', range: '1h', layout: 'mobile', detail: 'standard', theme: 'dark', lang: 'en', section: 'dashboard' });
    const handler = createSnapshotHandler(pool, sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.send).toHaveBeenCalled();
    expect(pool.endCapture).toHaveBeenCalled();
  });

  it('captures desktop screenshot', async () => {
    (parseSnapshotRequest as any).mockReturnValue({ format: 'png', range: '1h', layout: 'desktop', detail: 'standard', theme: 'dark', lang: 'en', section: 'dashboard' });
    const handler = createSnapshotHandler(pool, sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(pool.endCapture).toHaveBeenCalled();
  });

  it('returns 503 on capture error and still calls endCapture', async () => {
    (parseSnapshotRequest as any).mockReturnValue({ format: 'png', range: '1h', layout: 'desktop', detail: 'standard', theme: 'dark', lang: 'en', section: 'dashboard' });
    const { capture } = await import('../../browser/capture');
    (capture as any).mockRejectedValueOnce(new Error('browser crash'));
    const handler = createSnapshotHandler(pool, sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(pool.endCapture).toHaveBeenCalled();
  });
});
