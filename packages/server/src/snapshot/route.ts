import type { Request, Response } from 'express';
import { parseSnapshotRequest, RANGE_MAP, type SnapshotRequest } from './types';
import { buildSnapshotData, type DataSources } from './data-service';
import { renderTemplate } from './template-renderer';
import { capture as captureDesktop, captureFromHtml } from '../screenshot/capture';
import type { BrowserPool } from '../screenshot/browser-pool';
import { config } from '../config';

const VIEWPORT_MAP = {
  'mobile-compact': { width: 390 },
  'mobile-standard': { width: 540 },
  'mobile-full': { width: 540 },
} as const;

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
        const templateName = `mobile-${params.detail}` as 'mobile-compact' | 'mobile-standard' | 'mobile-full';
        const html = renderTemplate(templateName, data, { theme: params.theme, lang: params.lang });
        const viewport = VIEWPORT_MAP[templateName];
        buffer = await captureFromHtml(pool, { html, viewportWidth: viewport.width });
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
      res.set('Content-Disposition', `attachment; filename="claw-insights-${params.layout}-${params.detail}-${ts}.png"`);
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
