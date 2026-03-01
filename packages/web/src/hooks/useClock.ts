import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '../i18n/context';

interface ClockData {
  /** HH:mm — no seconds to avoid distracting ticking */
  time: string;
  /** e.g. "Sunday, 1 March" or "星期日, 3月1日" */
  date: string;
}

const LOCALE_MAP: Record<string, string> = {
  en: 'en-GB',
  zh: 'zh-CN',
};

function formatClock(locale: string): ClockData {
  const d = new Date();
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return { time, date };
}

export function useClock(intervalMs = 10_000): ClockData {
  const { lang } = useI18n();
  const locale = LOCALE_MAP[lang] ?? 'en-GB';

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);
  // Re-compute on tick or locale change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => formatClock(locale), [locale, tick]);
}
