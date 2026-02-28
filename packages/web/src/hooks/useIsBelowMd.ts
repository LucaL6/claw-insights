import { useEffect, useState } from 'react';

/** Must stay in sync with Tailwind's `md` breakpoint (768px). */
const MD = 768;

export function useIsBelowMd() {
  const [below, setBelow] = useState(() => typeof window !== 'undefined' && window.innerWidth < MD);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MD - 1}px)`);
    setBelow(mq.matches); // eslint-disable-line react-hooks/set-state-in-effect -- sync initial value from matchMedia
    const handler = (e: MediaQueryListEvent) => {
      setBelow(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => {
      mq.removeEventListener('change', handler);
    };
  }, []);
  return below;
}
