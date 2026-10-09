// The addresses the profile and the evidence drawer link to (the shared note's table of links between views), and the
// click handler that follows one inside the app while a modified click still opens a new tab. A view that isn't built
// yet still gets its address; it lands there once it is.
import type { MouseEvent } from 'react';
import { DOCUMENT_PARAM, navigate, OBJECT_PARAM, viewHref } from '../shell/route';

/** `Type:pk`, the form every cross-view address carries an object in. */
export function objectRef(type: string, pk: string): string {
  return `${type}:${pk}`;
}

function withParams(investigation: string, view: string, params: Record<string, string>): string {
  return `${viewHref(investigation, view)}?${new URLSearchParams(params)}`;
}

/** An object's profile on its own, full width, with no exploration. */
export function profileHref(investigation: string, type: string, pk: string): string {
  return withParams(investigation, 'browser', { [OBJECT_PARAM]: objectRef(type, pk) });
}

export function graphHref(investigation: string, type: string, pk: string): string {
  return withParams(investigation, 'graph', { focus: objectRef(type, pk) });
}

export function timelineHref(investigation: string, type: string, pk: string): string {
  return withParams(investigation, 'timeline', { object: objectRef(type, pk) });
}

/** The Assistant with a question filled in; it is never sent on its own. */
export function assistantHref(investigation: string, question: string): string {
  return withParams(investigation, 'assistant', { q: question });
}

/** Files, opened at one file and one passage in it. */
export function filesHref(investigation: string, documentId: string, passageId: string): string {
  return withParams(investigation, 'files', { [DOCUMENT_PARAM]: documentId, passage: passageId });
}

/** An onClick for a link inside the app: a plain click navigates in place, any modified click is left to the browser. */
export function follow(href: string, after?: () => void) {
  return (e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
    after?.();
  };
}
