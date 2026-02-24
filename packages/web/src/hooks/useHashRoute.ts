import { useCallback,useEffect, useState } from 'react';

export type Page = 'dashboard' | 'logs';

export interface Route {
  page: Page;
  params: Record<string, string>;
}

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [path, qs] = clean.split('?');
  const page: Page = path === 'logs' ? 'logs' : 'dashboard';
  const params: Record<string, string> = {};
  if (qs) {
    for (const pair of qs.split('&')) {
      const [k, v] = pair.split('=');
      if (k) {params[decodeURIComponent(k)] = decodeURIComponent(v);}
    }
  }
  return { page, params };
}

export function useHashRoute(): { route: Route; navigate: (hash: string) => void } {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => { setRoute(parseHash(window.location.hash)); };
    window.addEventListener('hashchange', handler);
    return () => { window.removeEventListener('hashchange', handler); };
  }, []);

  const navigate = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  return { route, navigate };
}
