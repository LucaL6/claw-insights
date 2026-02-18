import type { Request, Response } from 'express';
import { parseSnapshotRequest, RANGE_MAP, type SnapshotRequest } from '../services/snapshot-types.js';
import { buildSnapshotData } from '../services/snapshot-service.js';
import type { DataSources } from '../services/snapshot-types.js';
import { renderSnapshot, VIEWPORT_WIDTH } from '../services/snapshot-template/index.js';
import { capture as captureDesktop, captureFromHtml } from '../browser/capture.js';
import type { BrowserPool } from '../browser/browser-pool.js';
import { config } from '../config.js';

export function createSnapshotHandler(pool: BrowserPool, sources: DataSources) {
  return async (req: Request, res: Response) => {
    let params: SnapshotRequest;
    try {
      params = parseSnapshotRequest(req.body ?? {});
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    const internalRange = RANGE_MAP[params.range];

    // JSON format — no concurrency limit
    if (params.format === 'json') {
      const data = await buildSnapshotData(sources, { detail: params.detail, range: internalRange });
      res.json(data);
      return;
    }

    // PNG format — concurrency limit
    if (!pool.canCapture()) {
      res.status(503).json({ error: 'Too many concurrent screenshot requests. Try again.' });
      return;
    }

    pool.beginCapture();
    try {
      let buffer: Buffer;

      if (params.layout === 'mobile') {
        const data = await buildSnapshotData(sources, { detail: params.detail, range: internalRange });
        const html = renderSnapshot(data, { detail: params.detail, theme: params.theme, lang: params.lang });
        buffer = await captureFromHtml(pool, { html, viewportWidth: VIEWPORT_WIDTH[params.detail] });
      } else {
        buffer = await captureDesktop(pool, {
          section: params.section,
          range: internalRange as 'ONE_HOUR' | 'SIX_HOUR' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR',
          theme: params.theme,
          lang: params.lang,
          webPort: config.webPort,
        });
      }

      const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
      res.set('Content-Type', 'image/png');
      res.set(
        'Content-Disposition',
        `attachment; filename="claw-insights-${params.layout}-${params.detail}-${ts}.png"`,
      );
      res.set('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      console.error('[snapshot] capture failed:', err);
      res.status(503).json({ error: 'Snapshot capture failed' });
    } finally {
      pool.endCapture();
    }
  };
}
