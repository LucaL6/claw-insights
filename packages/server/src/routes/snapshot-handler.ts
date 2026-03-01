import type { Request, Response } from 'express';

import { createChildLogger } from '../logger.js';
import type { SnapshotEngine } from '../services/snapshot-engine.js';
import { parseSnapshotRequest } from '../services/snapshot-types.js';
import {
  CollectTimeoutError,
  ErrorCodes,
  GatewayUnreachableError,
  makeErrorResponse,
  PayloadTooLargeError,
  QueueFullError,
  QueueTimeoutError,
  RateLimitedError,
  TotalTimeoutError,
} from '../utils/snapshot-errors.js';

const log = createChildLogger('snapshot');

function sendError(
  res: Response,
  status: number,
  code: string,
  error: string,
  opts?: { retryAfter?: number; suggestion?: string },
  t0?: number,
): void {
  if (t0 != null) {
    res.set('X-Snapshot-Duration', String(Math.round(performance.now() - t0)));
  }
  if (opts?.retryAfter) {
    res.set('Retry-After', String(opts.retryAfter));
  }
  res.status(status).json(makeErrorResponse(code, error, opts));
}

export function createSnapshotHandler(engine: SnapshotEngine) {
  return async (req: Request, res: Response) => {
    const t0 = performance.now();

    // Parse params (before engine — invalid params don't consume rate limit)
    let params;
    try {
      params = parseSnapshotRequest(req.body ?? {});
    } catch (err) {
      sendError(
        res,
        400,
        ErrorCodes.INVALID_PARAM,
        (err as Error).message,
        { suggestion: 'Check parameter values.' },
        t0,
      );
      return;
    }

    try {
      const result = await engine.execute(params);

      // JSON format
      if (result.format === 'json') {
        res.set('X-Snapshot-Duration', String(result.durationMs));
        if (result.degradedSources.length > 0) {
          res.set('X-Snapshot-Degraded-Sources', result.degradedSources.join(','));
        }
        res.json(result.output);
        return;
      }

      // PNG/SVG success response
      const now = new Date();
      const localDate = now.toLocaleDateString('sv-SE'); // YYYY-MM-DD
      const localTime = now
        .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        .replace(':', '-');
      const ts = `${localDate}-${localTime}`;
      const ext = result.format === 'svg' ? 'svg' : 'png';
      const filename = `claw-insights-${result.detail}-${params.range}-${params.theme}-${ts}.${ext}`;

      res.set('Content-Type', result.contentType);
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.set('X-Filename', filename);
      res.set('X-Snapshot-Duration', String(result.durationMs));
      res.set('Cache-Control', 'no-store');
      if (result.degradedSources.length > 0) {
        res.set('X-Snapshot-Degraded-Sources', result.degradedSources.join(','));
      }
      if (result.degraded) {
        res.set('X-Snapshot-Degraded', `detail=${result.detail} (requested ${params.detail}, exceeded 2MB limit)`);
      }
      res.send(result.output);
    } catch (err) {
      if (err instanceof RateLimitedError) {
        const retryAfter = Math.ceil(err.retryAfterMs / 1000);
        sendError(
          res,
          429,
          ErrorCodes.RATE_LIMITED,
          'Too many requests.',
          { retryAfter, suggestion: `Wait ${retryAfter}s.` },
          t0,
        );
      } else if (err instanceof QueueFullError) {
        sendError(
          res,
          503,
          ErrorCodes.QUEUE_FULL,
          'Render queue is full.',
          { retryAfter: 3, suggestion: 'Too many concurrent requests. Wait and retry.' },
          t0,
        );
      } else if (err instanceof QueueTimeoutError) {
        sendError(
          res,
          503,
          ErrorCodes.QUEUE_TIMEOUT,
          'Queue wait timed out.',
          { retryAfter: 3, suggestion: 'Server is busy. Try again shortly.' },
          t0,
        );
      } else if (err instanceof CollectTimeoutError) {
        sendError(
          res,
          504,
          ErrorCodes.COLLECT_TIMEOUT,
          'Data collection timed out.',
          { suggestion: 'OpenClaw may be under heavy load.' },
          t0,
        );
      } else if (err instanceof TotalTimeoutError) {
        sendError(
          res,
          504,
          ErrorCodes.TOTAL_TIMEOUT,
          'Total snapshot timeout exceeded.',
          { suggestion: 'Try detail=compact or format=json.' },
          t0,
        );
      } else if (err instanceof PayloadTooLargeError) {
        sendError(
          res,
          413,
          ErrorCodes.PAYLOAD_TOO_LARGE,
          'Snapshot exceeds 2MB at all detail levels.',
          { suggestion: 'Use format=json.' },
          t0,
        );
      } else if (err instanceof GatewayUnreachableError) {
        sendError(
          res,
          502,
          ErrorCodes.GATEWAY_UNREACHABLE,
          'OpenClaw Gateway is not reachable.',
          { suggestion: 'Check if OpenClaw is running.' },
          t0,
        );
      } else {
        log.error({ err }, 'snapshot render failed');
        sendError(
          res,
          500,
          ErrorCodes.RENDER_FAILED,
          'Snapshot rendering failed.',
          { suggestion: 'Retry or use format=json.' },
          t0,
        );
      }
    }
  };
}
