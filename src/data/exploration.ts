// The exploration: the current set as plain JSON, short enough for the address bar. A start type, then filters and
// pivots in order; the type after the last pivot is the current type.
import { linkOf } from './catalog.ts';
import type { Catalog, Exploration, Step } from './types.ts';

const utf8 = { encode: (s: string) => new TextEncoder().encode(s), decode: (b: Uint8Array) => new TextDecoder().decode(b) };

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Compact JSON (no undefined, no default page size) in URL-safe base64. */
export function encodeExploration(exp: Exploration): string {
  const compact: Exploration = { start: exp.start, steps: exp.steps };
  if (exp.sort) compact.sort = exp.sort;
  if (exp.pageSize) compact.pageSize = exp.pageSize;
  return toBase64Url(utf8.encode(JSON.stringify(compact)));
}

export function decodeExploration(encoded: string): Exploration {
  const parsed = JSON.parse(utf8.decode(fromBase64Url(encoded))) as Partial<Exploration>;
  if (typeof parsed.start !== 'string' || !Array.isArray(parsed.steps)) throw new Error('not an exploration');
  const exp: Exploration = { start: parsed.start, steps: parsed.steps as Step[] };
  if (parsed.sort) exp.sort = parsed.sort;
  if (parsed.pageSize) exp.pageSize = parsed.pageSize;
  return exp;
}

/** The type after the first `upTo` steps (all of them by default). */
export function typeAt(catalog: Catalog, exp: Exploration, upTo: number = exp.steps.length): string {
  let type = exp.start;
  for (const step of exp.steps.slice(0, upTo)) {
    if ('pivot' in step) {
      const link = linkOf(catalog, type, step.pivot);
      if (!link) throw new Error(`${type} has no link ${step.pivot}`);
      type = link.targetType;
    }
  }
  return type;
}

export function currentType(catalog: Catalog, exp: Exploration): string {
  return typeAt(catalog, exp);
}

export function withStep(exp: Exploration, step: Step): Exploration {
  return { ...exp, steps: [...exp.steps, step], sort: 'pivot' in step ? undefined : exp.sort };
}

export function startExploration(type: string, pageSize = 50): Exploration {
  return { start: type, steps: [], pageSize };
}
