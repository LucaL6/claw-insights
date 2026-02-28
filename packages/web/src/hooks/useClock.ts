import { useEffect, useState } from 'react';

interface ClockData {
  /** HH:mm:ss — same locale/format as CollapsibleSection "updated" timestamp */
  time: string;
  /** e.g. "Sun, 1 Mar" */
  date: string;
}

function now(): ClockData {
  const d = new Date();
  // HH:mm only — no seconds to avoid distracting ticking
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return { time, date };
}

export function useClock(intervalMs = 10_000): ClockData {
  const [clock, setClock] = useState(now);
  useEffect(() => {
    const id = setInterval(() => {
      setClock(now());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);
  return clock;
}
