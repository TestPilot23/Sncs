import { useEffect, useState } from 'react';

export const ROUTES = ['home', 'services', 'gallery', 'about', 'contact'] as const;
export type Route = (typeof ROUTES)[number];

export function parseHash(): Route {
  const h = (window.location.hash || '').replace(/^#\/?/, '').split('/')[0].toLowerCase();
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'home';
}

export function hashFor(route: Route): string {
  return '#/' + (route === 'home' ? '' : route);
}

export function navigate(route: Route): void {
  window.location.hash = hashFor(route);
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash());
  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
