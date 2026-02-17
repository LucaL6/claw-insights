import { useState, useCallback } from 'react';

interface ScreenshotOptions {
  section: 'dashboard' | 'logs';
  range: string;
  theme: string;
  lang: string;
}

const RANGE_SHORT: Record<string, string> = {
  ONE_HOUR: '1h',
  SIX_HOUR: '6h',
  TWELVE_HOUR: '12h',
  TWENTY_FOUR_HOUR: '24h',
};

export function useScreenshot() {
  const [screenshotting, setScreenshotting] = useState(false);

  const takeScreenshot = useCallback(async (opts: ScreenshotOptions) => {
    setScreenshotting(true);
    try {
      const rangeValue = RANGE_SHORT[opts.range] ?? '24h';
      const res = await fetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: 'desktop',
          detail: 'standard',
          section: opts.section,
          range: rangeValue,
          theme: opts.theme,
          lang: opts.lang,
          format: 'png',
        }),
      });
      if (!res.ok) throw new Error('Snapshot failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claw-insights-desktop-standard-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[screenshot]', e);
    } finally {
      setScreenshotting(false);
    }
  }, []);

  return { screenshotting, takeScreenshot };
}
