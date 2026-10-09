// The address bar is the source of truth for where the analyst is: /:investigation/:view, plus the open exploration
// as ?exploration= and, in Browser, the open object as ?object=. Back, forward, refresh and a pasted link all land on
// the same screen. A few lines over the History API; no router package.
import { useSyncExternalStore } from 'react';
import { DEFAULT_VIEW } from './nav';

export const DEFAULT_INVESTIGATION = 'a';

/** The query parameter that carries the encoded exploration (src/data's encodeExploration). */
export const EXPLORATION_PARAM = 'exploration';

/** The query parameter that carries the object open in Browser, by its key. */
export const OBJECT_PARAM = 'object';

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

/** One query parameter's value, re-read on every navigation. */
export function useSearchParam(name: string): string | null {
  return useSyncExternalStore(subscribe, () => new URLSearchParams(window.location.search).get(name));
}

/** Push a new entry (Back undoes it), or replace the current one for changes Back should skip. */
export function navigate(to: string, { replace = false }: { replace?: boolean } = {}): void {
  if (to === window.location.pathname + window.location.search) return;
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
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

/** A view's address, with an encoded exploration when the view should open one. */
export function viewHref(investigation: string, view: string, exploration?: string): string {
  const path = `/${investigation}/${view}`;
  return exploration ? `${path}?${new URLSearchParams({ [EXPLORATION_PARAM]: exploration })}` : path;
}

/** A bare `/` or `/:investigation` becomes the full path once, in place, so history never holds the short form. */
export function settleRoute(): void {
  const { investigation, view } = parseRoute(window.location.pathname);
  const full = viewHref(investigation, view);
  if (window.location.pathname !== full) window.history.replaceState(null, '', full + window.location.search);
}
