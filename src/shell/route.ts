// The address bar is the source of truth for where the analyst is: /:investigation/:view, plus the open exploration
// as ?exploration=, in Browser the open object as ?object=, in Files the open folder and file as ?folder= and ?document=.
// Back, forward, refresh and a pasted link all land on the same screen. A few lines over the History API; no router.
import { useSyncExternalStore } from 'react';
import { DEFAULT_VIEW } from './nav';


/** The query parameter that carries the encoded exploration (src/data's encodeExploration). */
export const EXPLORATION_PARAM = 'exploration';

/** The query parameter that carries the object open in Browser, by its key. */
export const OBJECT_PARAM = 'object';

/** Files: the open folder and the open file, by their ids. */
export const FOLDER_PARAM = 'folder';
export const DOCUMENT_PARAM = 'document';
/** A passage in the open file: scrolled to and outlined. Other views link to evidence this way. */
export const PASSAGE_PARAM = 'passage';

/** A file in Files, at a passage when given. */
export function fileHref(investigation: string, documentId: string, passageId?: string): string {
  const q = new URLSearchParams({ [DOCUMENT_PARAM]: documentId });
  if (passageId) q.set(PASSAGE_PARAM, passageId);
  return `${viewHref(investigation, 'files')}?${q}`;
}

/** A folder in Files; the investigation's top level without one. */
export function folderHref(investigation: string, folderId?: string | null): string {
  const base = viewHref(investigation, 'files');
  return folderId ? `${base}?${new URLSearchParams({ [FOLDER_PARAM]: folderId })}` : base;
}

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
  /** The investigation's id from the engine, or null on a bare `/`: the shell then opens the first one it lists. */
  investigation: string | null;
  view: string;
}

export function parseRoute(path: string): Route {
  const [investigation, view] = path.split('/').filter(Boolean);
  return { investigation: investigation ?? null, view: view ?? DEFAULT_VIEW };
}

/** A view's address, with an encoded exploration when the view should open one. */
export function viewHref(investigation: string, view: string, exploration?: string): string {
  const path = `/${investigation}/${view}`;
  return exploration ? `${path}?${new URLSearchParams({ [EXPLORATION_PARAM]: exploration })}` : path;
}

/** `/:investigation` becomes the full path once, in place, so history never holds the short form. A bare `/` waits
 * for the engine's list of investigations; the shell settles it. */
export function settleRoute(): void {
  const { investigation, view } = parseRoute(window.location.pathname);
  if (!investigation) return;
  const full = viewHref(investigation, view);
  if (window.location.pathname !== full) window.history.replaceState(null, '', full + window.location.search);
}
