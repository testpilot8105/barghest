// The address bar is the source of truth for where the analyst is: /:investigation/:view. Back, forward, refresh and
// a pasted link all land on the same screen. A few lines over the History API; no router package.
import { useSyncExternalStore } from 'react';
import { DEFAULT_VIEW } from './nav';

export const DEFAULT_INVESTIGATION = 'a';

const CHANGE = 'barghest:navigate';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function navigate(to: string): void {
  if (to === window.location.pathname + window.location.search) return;
  window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(CHANGE));
}

export interface Route {
  investigation: string;
  view: string;
}

export function parseRoute(path: string): Route {
  const [investigation, view] = path.split('/').filter(Boolean);
  return { investigation: investigation ?? DEFAULT_INVESTIGATION, view: view ?? DEFAULT_VIEW };
}

export function viewHref(investigation: string, view: string): string {
  return `/${investigation}/${view}`;
}

/** A bare `/` or `/:investigation` becomes the full path once, in place, so history never holds the short form. */
export function settleRoute(): void {
  const { investigation, view } = parseRoute(window.location.pathname);
  const full = viewHref(investigation, view);
  if (window.location.pathname !== full) window.history.replaceState(null, '', full + window.location.search);
}
