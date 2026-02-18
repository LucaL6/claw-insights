import { SHARED_CSS, TAILWIND_CDN, FONT_LINK, TAILWIND_CONFIG, COLORS } from './constants.js';
import { renderHeader } from './header.js';
import { renderMetrics } from './metrics.js';
import { renderSessions } from './sessions.js';
import { renderCharts } from './charts.js';
import { renderErrors } from './errors.js';
import { renderFooter } from './footer.js';
import type { SnapshotData, Detail, Theme, Lang } from '../snapshot-types.js';

const VIEWPORT_WIDTH: Record<Detail, number> = {
  compact: 390,
  standard: 540,
  full: 540,
};

export interface RenderOptions {
  detail: Detail;
  theme: Theme;
  lang: Lang;
}

export function renderSnapshot(data: SnapshotData, opts: RenderOptions): string {
  const { detail, theme, lang } = opts;
  const width = VIEWPORT_WIDTH[detail];

  const sections = [renderHeader(data, detail), renderMetrics(data, detail)];

  if (detail === 'standard' || detail === 'full') {
    sections.push(renderSessions(data, detail));
  }

  sections.push(renderCharts(data, detail));

  if (detail === 'full') {
    sections.push(renderErrors(data));
  }

  sections.push(renderFooter(data));

  const body = sections.filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  ${TAILWIND_CDN}
  ${FONT_LINK}
  ${TAILWIND_CONFIG}
  <style>${SHARED_CSS}</style>
</head>
<body class="bg-[${COLORS.bg}] font-sans" data-theme="${theme}">
  <div class="w-[${width}px]">
    ${body}
  </div>
  <script>document.body.setAttribute('data-ready', 'true');</script>
</body>
</html>`;
}

export { VIEWPORT_WIDTH };
