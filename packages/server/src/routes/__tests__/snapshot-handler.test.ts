import type { Request, Response } from 'express';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SnapshotEngine, SnapshotResult } from '../../services/snapshot-engine.js';
import {
  CollectTimeoutError,
  ErrorCodes,
  GatewayUnreachableError,
  PayloadTooLargeError,
  QueueFullError,
  QueueTimeoutError,
  RateLimitedError,
  TotalTimeoutError,
} from '../../utils/snapshot-errors.js';
import { createSnapshotHandler } from '../snapshot-handler.js';

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    set: vi.fn(),
    send: vi.fn(),
  } as unknown as Response & { status: Mock; json: Mock; set: Mock; send: Mock };
}

function mockEngine(executeImpl?: Mock): SnapshotEngine {
  return {
    execute: executeImpl ?? vi.fn(),
  } as unknown as SnapshotEngine;
}

const BASE_RESULT: SnapshotResult = {
  format: 'png',
  output: Buffer.from('fake-png'),
  contentType: 'image/png',
  detail: 'standard',
  degraded: false,
  durationMs: 42,
};

describe('createSnapshotHandler', () => {
  let engine: SnapshotEngine;
  let executeMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    executeMock = vi.fn().mockResolvedValue({ ...BASE_RESULT });
    engine = mockEngine(executeMock);
  });

  it('returns 400 INVALID_PARAM for invalid parameters', async () => {
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: { format: 'bmp' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCodes.INVALID_PARAM }));
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('returns PNG with correct headers', async () => {
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: { format: 'png' } } as unknown as Request, res);
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.set).toHaveBeenCalledWith('X-Snapshot-Duration', '42');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('fake-png'));
  });

  it('returns SVG with correct content-type', async () => {
    executeMock.mockResolvedValue({
      ...BASE_RESULT,
      format: 'svg',
      output: '<svg></svg>',
      contentType: 'image/svg+xml',
    });
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: { format: 'svg' } } as unknown as Request, res);
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/svg+xml');
    expect(res.send).toHaveBeenCalledWith('<svg></svg>');
  });

  it('returns JSON via res.json', async () => {
    executeMock.mockResolvedValue({
      ...BASE_RESULT,
      format: 'json',
      output: { gateway: {} },
      contentType: 'application/json',
    });
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: { format: 'json' } } as unknown as Request, res);
    expect(res.json).toHaveBeenCalledWith({ gateway: {} });
    expect(res.set).toHaveBeenCalledWith('X-Snapshot-Duration', '42');
  });

  it('includes detail, range, theme in Content-Disposition filename', async () => {
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: { detail: 'standard', range: '6h', theme: 'dark' } } as unknown as Request, res);
    const cdCall = (res.set as Mock).mock.calls.find((c: string[]) => c[0] === 'Content-Disposition');
    expect(cdCall).toBeDefined();
    expect(cdCall![1]).toMatch(/^attachment; filename="claw-insights-standard-6h-dark-.*\.png"$/);
  });

  it('sets X-Snapshot-Degraded header when detail downgraded', async () => {
    executeMock.mockResolvedValue({
      ...BASE_RESULT,
      detail: 'compact',
      degraded: true,
    });
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: { detail: 'full' } } as unknown as Request, res);
    expect(res.set).toHaveBeenCalledWith('X-Snapshot-Degraded', expect.stringContaining('compact'));
  });

  it('returns 429 with Retry-After when rate limited', async () => {
    executeMock.mockRejectedValue(new RateLimitedError(3000));
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: {} } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.set).toHaveBeenCalledWith('Retry-After', '3');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCodes.RATE_LIMITED }));
  });

  it('returns 503 QUEUE_FULL when render queue is full', async () => {
    executeMock.mockRejectedValue(new QueueFullError(10));
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: {} } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCodes.QUEUE_FULL }));
  });

  it('returns 503 QUEUE_TIMEOUT on queue wait timeout', async () => {
    executeMock.mockRejectedValue(new QueueTimeoutError());
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: {} } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCodes.QUEUE_TIMEOUT }));
  });

  it('returns 504 COLLECT_TIMEOUT on data collection timeout', async () => {
    executeMock.mockRejectedValue(new CollectTimeoutError());
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: {} } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCodes.COLLECT_TIMEOUT }));
  });

  it('returns 504 TOTAL_TIMEOUT on total timeout', async () => {
    executeMock.mockRejectedValue(new TotalTimeoutError());
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: {} } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCodes.TOTAL_TIMEOUT }));
  });

  it('returns 413 PAYLOAD_TOO_LARGE when all levels exceed limit', async () => {
    executeMock.mockRejectedValue(new PayloadTooLargeError());
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: {} } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCodes.PAYLOAD_TOO_LARGE }));
  });

  it('returns 502 GATEWAY_UNREACHABLE when gateway is not reachable', async () => {
    executeMock.mockRejectedValue(new GatewayUnreachableError());
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: {} } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCodes.GATEWAY_UNREACHABLE }));
  });

  it('returns 500 RENDER_FAILED on unexpected errors', async () => {
    executeMock.mockRejectedValue(new Error('unexpected'));
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: {} } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCodes.RENDER_FAILED }));
  });

  it('returns X-Snapshot-Duration on error responses too', async () => {
    executeMock.mockRejectedValue(new CollectTimeoutError());
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: {} } as unknown as Request, res);
    const durationCall = (res.set as Mock).mock.calls.find((c: string[]) => c[0] === 'X-Snapshot-Duration');
    expect(durationCall).toBeDefined();
    expect(Number(durationCall![1])).toBeGreaterThanOrEqual(0);
  });

  it('SVG filename has .svg extension', async () => {
    executeMock.mockResolvedValue({
      ...BASE_RESULT,
      format: 'svg',
      output: '<svg></svg>',
      contentType: 'image/svg+xml',
    });
    const handler = createSnapshotHandler(engine);
    const res = mockRes();
    await handler({ body: { format: 'svg' } } as unknown as Request, res);
    const cdCall = (res.set as Mock).mock.calls.find((c: string[]) => c[0] === 'Content-Disposition');
    expect(cdCall![1]).toMatch(/\.svg"$/);
  });
});
