import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/snapshot-types.js', () => ({
  parseSnapshotRequest: vi.fn(),
  RANGE_MAP: { '1h': 'ONE_HOUR', '6h': 'SIX_HOUR', '12h': 'TWELVE_HOUR', '24h': 'TWENTY_FOUR_HOUR' },
}));

vi.mock('../../services/snapshot-service.js', () => ({
  buildSnapshotData: vi.fn(async () => ({ gateway: {}, sessions: [] })),
}));

vi.mock('../../renderer/satori-renderer.js', () => ({
  renderSnapshot: vi.fn(async () => Buffer.from('fake-png')),
}));

import { createSnapshotHandler } from '../snapshot-handler.js';
import { parseSnapshotRequest } from '../../services/snapshot-types.js';
import { renderSnapshot } from '../../renderer/satori-renderer.js';

function mockRes() {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn(), set: vi.fn(), send: vi.fn() };
  return res;
}

describe('createSnapshotHandler', () => {
  const sources: any = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 on invalid request', async () => {
    (parseSnapshotRequest as any).mockImplementation(() => { throw new Error('bad input'); });
    const handler = createSnapshotHandler(sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'bad input' });
  });

  it('returns JSON for json format', async () => {
    (parseSnapshotRequest as any).mockReturnValue({ format: 'json', range: '1h', detail: 'standard' });
    const handler = createSnapshotHandler(sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.json).toHaveBeenCalledWith(expect.any(Object));
    expect(renderSnapshot).not.toHaveBeenCalled();
  });

  it('returns PNG with correct headers', async () => {
    (parseSnapshotRequest as any).mockReturnValue({ format: 'png', range: '1h', detail: 'standard', theme: 'dark', lang: 'en' });
    const handler = createSnapshotHandler(sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('fake-png'));
    expect(renderSnapshot).toHaveBeenCalledWith(
      expect.any(Object),
      { detail: 'standard', theme: 'dark', lang: 'en' },
    );
  });

  it('includes detail, range, and theme in Content-Disposition filename', async () => {
    (parseSnapshotRequest as any).mockReturnValue({ format: 'png', range: '6h', detail: 'standard', theme: 'dark', lang: 'en' });
    const handler = createSnapshotHandler(sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    const cdCall = (res.set as any).mock.calls.find((c: any) => c[0] === 'Content-Disposition');
    expect(cdCall).toBeDefined();
    const filename = cdCall[1];
    expect(filename).toContain('standard');
    expect(filename).toContain('6h');
    expect(filename).toContain('dark');
    expect(filename).toMatch(/^attachment; filename="claw-insights-standard-6h-dark-.*\.png"$/);
  });

  it('returns 503 on render error', async () => {
    (parseSnapshotRequest as any).mockReturnValue({ format: 'png', range: '1h', detail: 'standard', theme: 'dark', lang: 'en' });
    (renderSnapshot as any).mockRejectedValueOnce(new Error('render crash'));
    const handler = createSnapshotHandler(sources);
    const res = mockRes();
    await handler({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Snapshot render failed' });
  });
});
