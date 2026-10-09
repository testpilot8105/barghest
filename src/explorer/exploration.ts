// The open exploration, read from the address bar. A link that will not decode, or that names a type, link or
// property the catalog does not have, is "broken" rather than an error halfway down the screen.
import { useMemo } from 'react';
import { currentType, decodeExploration, encodeExploration, propertyOf, typeAt, type Catalog, type Exploration, type Filter, type Step } from '../data/index.ts';
import { EXPLORATION_PARAM, navigate, useSearchParam, viewHref } from '../shell/route';

export type OpenExploration =
  | { kind: 'none' }
  | { kind: 'broken' }
  | { kind: 'ok'; exp: Exploration; encoded: string; type: string };

export function parseExploration(catalog: Catalog, encoded: string | null): OpenExploration {
  if (!encoded) return { kind: 'none' };
  try {
    const exp = decodeExploration(encoded);
    if (!catalog.types[exp.start]) return { kind: 'broken' };
    exp.steps.forEach((step, i) => {
      if ('filter' in step && !propertyOf(catalog, typeAt(catalog, exp, i), step.filter.property)) throw new Error('unknown property');
    });
    return { kind: 'ok', exp, encoded, type: currentType(catalog, exp) };
  } catch {
    return { kind: 'broken' };
  }
}

export function useOpenExploration(catalog: Catalog): OpenExploration {
  const encoded = useSearchParam(EXPLORATION_PARAM);
  return useMemo(() => parseExploration(catalog, encoded), [catalog, encoded]);
}

/** Open an exploration in a view; each step is its own history entry, so Back undoes it. */
export function openExploration(investigation: string, view: string, exp: Exploration | null): void {
  navigate(viewHref(investigation, view, exp ? encodeExploration(exp) : undefined));
}

/** The exploration up to (not including) step `upTo`. */
export function prefix(exp: Exploration, upTo: number): Exploration {
  return { start: exp.start, steps: exp.steps.slice(0, upTo), pageSize: exp.pageSize };
}

/** Whether the set already keeps exactly this filter on its current type, i.e. since its last search around. Adding it
 *  again would change nothing but stack a duplicate card (owner, 09.10.2026: clicking a value again flooded the path). */
export function hasFilter(exp: Exploration, filter: Filter): boolean {
  const since = exp.steps.map((s) => 'pivot' in s).lastIndexOf(true) + 1;
  const same = JSON.stringify(filter);
  return exp.steps.slice(since).some((s) => 'filter' in s && JSON.stringify(s.filter) === same);
}

/** Drop one step. A filter goes on its own; a pivot takes every later step with it, since they read the old type. */
export function withoutStep(exp: Exploration, index: number): Exploration {
  const step: Step = exp.steps[index];
  const steps = 'pivot' in step ? exp.steps.slice(0, index) : exp.steps.filter((_, i) => i !== index);
  return { ...exp, steps, sort: 'pivot' in step ? undefined : exp.sort };
}
