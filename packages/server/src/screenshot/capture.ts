import type { BrowserPool } from './browser-pool';

const VALID_SECTIONS = ['dashboard', 'sessions', 'metrics', 'logs'] as const;
type Section = (typeof VALID_SECTIONS)[number];
type MetricsRange = 'ONE_HOUR' | 'SIX_HOUR' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

export interface CaptureOptions {
  section: Section;
  range: MetricsRange;
  theme: 'dark' | 'light';
  lang: 'en' | 'zh';
  webPort?: number;
  timeoutMs?: number;
}

export async function capture(pool: BrowserPool, options: CaptureOptions): Promise<Buffer> {
  const {
    section,
    range,
    theme,
    lang,
    webPort = 3200,
    timeoutMs = 15_000,
  } = options;

  if (!(VALID_SECTIONS as readonly string[]).includes(section)) {
    throw new Error(`Invalid section: ${section}. Must be one of: ${VALID_SECTIONS.join(', ')}`);
  }

  const page = section === 'logs' ? 'logs' : 'dashboard';
  const url = `http://localhost:${webPort}/#${page}?range=${range}&theme=${theme}&lang=${lang}`;

  const browser = await pool.acquire();
  // 1920px gives sessions column enough room (5/12 = 800px vs 587px at 1440)
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const pg = await ctx.newPage();

  try {
    await pg.goto(url, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-ready="true"]', { timeout: timeoutMs });

    // Extra delay for ECharts canvas rendering to finish
    await pg.waitForTimeout(500);

    let buffer: Buffer;

    if (section === 'sessions') {
      const el = pg.locator('[data-section="sessions"]');
      buffer = (await el.screenshot({ type: 'png' })) as Buffer;
    } else if (section === 'metrics') {
      const el = pg.locator('[data-section="metrics"]');
      buffer = (await el.screenshot({ type: 'png' })) as Buffer;
    } else {
      // Full viewport for 'dashboard' and 'logs'
      buffer = (await pg.screenshot({ type: 'png', fullPage: false })) as Buffer;
    }

    return buffer;
  } finally {
    await ctx.close();
  }
}

export interface HtmlCaptureOptions {
  html: string;
  viewportWidth: number;
  viewportHeight?: number;
  fullPage?: boolean;
  timeoutMs?: number;
}

export async function captureFromHtml(pool: BrowserPool, options: HtmlCaptureOptions): Promise<Buffer> {
  const { html, viewportWidth, viewportHeight = 1080, fullPage = true, timeoutMs = 15_000 } = options;

  const browser = await pool.acquire();
  const ctx = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 2,
  });
  const pg = await ctx.newPage();

  try {
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.waitForSelector('[data-ready="true"]', { timeout: timeoutMs });
    await pg.waitForTimeout(800);
    const buffer = (await pg.screenshot({ type: 'png', fullPage })) as Buffer;
    return buffer;
  } finally {
    await ctx.close();
  }
}
