import { Resvg } from '@resvg/resvg-js';
import type { ReactNode } from 'react';
import satori, { type SatoriOptions } from 'satori';

import type { SnapshotData } from '../services/snapshot-types.js';
import { loadFonts } from './fonts.js';
import { buildMarkup, type MarkupOptions, VIEWPORT_WIDTH } from './markup/index.js';

export type { MarkupOptions as RenderOptions };

export async function renderSnapshotSvg(data: SnapshotData, opts: MarkupOptions): Promise<string> {
  const width = VIEWPORT_WIDTH[opts.detail];
  const fonts = loadFonts();
  const markup = buildMarkup(data, opts);
  return satori(markup as unknown as ReactNode, { width, fonts: fonts as unknown as SatoriOptions['fonts'] });
}

export async function renderSnapshot(data: SnapshotData, opts: MarkupOptions): Promise<Buffer> {
  const width = VIEWPORT_WIDTH[opts.detail];
  const fonts = loadFonts();
  const markup = buildMarkup(data, opts);

  const svg = await satori(markup as unknown as ReactNode, {
    width,
    fonts: fonts as unknown as SatoriOptions['fonts'],
  });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width * 2 },
  });

  return Buffer.from(resvg.render().asPng());
}

export { VIEWPORT_WIDTH };
