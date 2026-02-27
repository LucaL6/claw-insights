import { useCallback, useState } from 'react';

import { showToast } from '../components/ui/toast-store';

interface SnapshotOptions {
  section: 'dashboard' | 'logs';
  range: string;
  theme: string;
  lang: string;
}

const RANGE_SHORT: Record<string, string> = {
  THIRTY_MIN: '30m',
  ONE_HOUR: '1h',
  SIX_HOUR: '6h',
  TWELVE_HOUR: '12h',
  TWENTY_FOUR_HOUR: '24h',
};

export function useSnapshot() {
  const [snapshotting, setSnapshotting] = useState(false);

  const takeSnapshot = useCallback(async (opts: SnapshotOptions) => {
    setSnapshotting(true);
    showToast('Generating snapshot...', 'success');
    try {
      const rangeValue = RANGE_SHORT[opts.range] ?? '24h';
      const res = await fetch('/api/snapshot', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detail: 'standard',
          range: rangeValue,
          theme: opts.theme,
          lang: opts.lang,
          format: 'png',
        }),
      });
      if (!res.ok) {
        throw new Error('Snapshot failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Prefer server-provided filename; fallback to local construction
      let filename = res.headers.get('X-Filename');
      if (!filename) {
        const now = new Date();
        const date = now.toLocaleDateString('sv-SE'); // YYYY-MM-DD
        const time = now
          .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
          .replace(':', '-');
        filename = `claw-insights-standard-${rangeValue}-${opts.theme}-${date}-${time}.png`;
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Snapshot saved', 'success');
    } catch (e) {
      console.error('[snapshot]', e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      showToast(`Snapshot failed: ${msg}`);
    } finally {
      setSnapshotting(false);
    }
  }, []);

  return { snapshotting, takeSnapshot };
}
