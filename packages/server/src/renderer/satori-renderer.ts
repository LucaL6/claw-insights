import { performance } from 'node:perf_hooks';

import { Resvg } from '@resvg/resvg-js';
import type { ReactNode } from 'react';
import satori, { type SatoriOptions } from 'satori';

import { createChildLogger } from '../logger.js';
import type { SnapshotData } from '../services/snapshot-types.js';
import { serializeError } from '../utils/error-serializer.js';
import { loadFonts } from './fonts.js';
import { buildMarkup, type MarkupOptions, VIEWPORT_WIDTH } from './markup/index.js';

const log = createChildLogger('satori-renderer');

export type { MarkupOptions as RenderOptions };

export async function renderSnapshotSvg(data: SnapshotData, opts: MarkupOptions): Promise<string> {
  const width = VIEWPORT_WIDTH[opts.detail];
  const fonts = loadFonts();
  const markup = buildMarkup(data, opts);
  log.debug({ detail: opts.detail, width }, 'renderSnapshotSvg start');
  const start = performance.now();
  const result = await satori(markup as unknown as ReactNode, {
    width,
    fonts: fonts as unknown as SatoriOptions['fonts'],
  });
  log.debug({ ms: Math.round(performance.now() - start) }, 'renderSnapshotSvg done');
  return result;
}

export async function renderSnapshot(data: SnapshotData, opts: MarkupOptions): Promise<Buffer> {
  const width = VIEWPORT_WIDTH[opts.detail];
  const fonts = loadFonts();
  const markup = buildMarkup(data, opts);

  log.debug({ detail: opts.detail, width }, 'renderSnapshot start');
  const start = performance.now();
  try {
    const svg = await satori(markup as unknown as ReactNode, {
      width,
      fonts: fonts as unknown as SatoriOptions['fonts'],
    });
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width * 2 },
    });

    const buf = Buffer.from(resvg.render().asPng());
    log.debug({ ms: Math.round(performance.now() - start), bytes: buf.length }, 'renderSnapshot done');
    return buf;
  } catch (err) {
    log.error({ err: serializeError(err), ms: Math.round(performance.now() - start) }, 'renderSnapshot failed');
    throw err;
  }
}

export { VIEWPORT_WIDTH };
