import type { Request, Response } from 'express';
import { BrowserPool } from './browser-pool';

const VALID_SECTIONS = ['dashboard', 'sessions', 'metrics', 'logs'] as const;
const VALID_RANGES = ['ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR'] as const;
const VALID_THEMES = ['dark', 'light'] as const;
const VALID_LANGS = ['en', 'zh'] as const;

type Section = typeof VALID_SECTIONS[number];
type MetricsRange = typeof VALID_RANGES[number];
type Theme = typeof VALID_THEMES[number];
type Lang = typeof VALID_LANGS[number];

export interface ScreenshotParams {
  section: Section;
  range: MetricsRange;
  theme: Theme;
  lang: Lang;
}

export function parseScreenshotParams(query: Record<string, unknown>): ScreenshotParams {
  const section = (query.section as string) ?? 'dashboard';
  if (!(VALID_SECTIONS as readonly string[]).includes(section)) {
    throw new Error(`Invalid section: ${section}. Must be one of: ${VALID_SECTIONS.join(', ')}`);
  }

  const range = (query.range as string) ?? 'TWENTY_FOUR_HOUR';
  if (!(VALID_RANGES as readonly string[]).includes(range)) {
    throw new Error(`Invalid range: ${range}. Must be one of: ${VALID_RANGES.join(', ')}`);
  }

  const theme = (query.theme as string) ?? 'dark';
  if (!(VALID_THEMES as readonly string[]).includes(theme)) {
    throw new Error(`Invalid theme: ${theme}. Must be one of: ${VALID_THEMES.join(', ')}`);
  }

  const lang = (query.lang as string) ?? 'en';
  if (!(VALID_LANGS as readonly string[]).includes(lang)) {
    throw new Error(`Invalid lang: ${lang}. Must be one of: ${VALID_LANGS.join(', ')}`);
  }

  return { section: section as Section, range: range as MetricsRange, theme: theme as Theme, lang: lang as Lang };
}

let activeCaptures = 0;
const MAX_CONCURRENT = 3;

export function createScreenshotHandler(pool: BrowserPool, webPort: number = 3200) {
  return async (req: Request, res: Response) => {
    let params: ScreenshotParams;
    try {
      params = parseScreenshotParams(req.query as Record<string, unknown>);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    if (activeCaptures >= MAX_CONCURRENT) {
      res.status(503).json({ error: 'Too many concurrent screenshot requests. Try again.' });
      return;
    }

    activeCaptures++;
    try {
      // capture() will be implemented in Task 7
      const { capture } = await import('./capture');
      const buffer = await capture(pool, { ...params, webPort });
      const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', `attachment; filename="claw-insights-${params.section}-${ts}.png"`);
      res.set('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      console.error('[screenshot] capture failed:', err);
      res.status(503).json({ error: 'Screenshot capture failed' });
    } finally {
      activeCaptures--;
    }
  };
}
