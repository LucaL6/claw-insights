import type { Request, Response } from 'express';
import { parseSnapshotRequest, RANGE_MAP } from '../services/snapshot-types.js';
import { buildSnapshotData } from '../services/snapshot-service.js';
import type { DataSources } from '../services/snapshot-types.js';
import { renderSnapshot } from '../renderer/satori-renderer.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('snapshot');

export function createSnapshotHandler(sources: DataSources) {
  return async (req: Request, res: Response) => {
    let params;
    try {
      params = parseSnapshotRequest(req.body ?? {});
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    const internalRange = RANGE_MAP[params.range];

    if (params.format === 'json') {
      const data = await buildSnapshotData(sources, { detail: params.detail, range: internalRange });
      res.json(data);
      return;
    }

    try {
      const t0 = performance.now();
      const data = await buildSnapshotData(sources, { detail: params.detail, range: internalRange });
      const t1 = performance.now();
      const buffer = await renderSnapshot(data, {
        detail: params.detail,
        theme: params.theme,
        lang: params.lang,
      });
      const t2 = performance.now();
      log.info(
        { dataMs: Math.round(t1 - t0), renderMs: Math.round(t2 - t1), totalMs: Math.round(t2 - t0) },
        'snapshot timing',
      );

      // Use local date+time matching what's displayed in the snapshot
      const now = new Date();
      const localDate = now.toLocaleDateString('sv-SE'); // YYYY-MM-DD
      const localTime = now
        .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        .replace(':', '-');
      const ts = `${localDate}-${localTime}`;
      const filename = `claw-insights-${params.detail}-${params.range}-${params.theme}-${ts}.png`;
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.set('X-Filename', filename);
      res.set('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      log.error({ err }, 'snapshot render failed');
      res.status(503).json({ error: 'Snapshot render failed' });
    }
  };
}
