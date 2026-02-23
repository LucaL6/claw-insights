import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.js';
import { buildMarkup, VIEWPORT_WIDTH, type MarkupOptions } from './markup/index.js';
import type { SnapshotData } from '../services/snapshot-types.js';

export type { MarkupOptions as RenderOptions };

export async function renderSnapshot(
  data: SnapshotData,
  opts: MarkupOptions,
): Promise<Buffer> {
  const width = VIEWPORT_WIDTH[opts.detail];
  const fonts = await loadFonts();
  const markup = buildMarkup(data, opts);

  const svg = await satori(markup as any, { width, fonts: fonts as any });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width * 2 },
  });

  return Buffer.from(resvg.render().asPng());
}

export { VIEWPORT_WIDTH };
