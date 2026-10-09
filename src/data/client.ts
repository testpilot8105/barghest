// The connection: fetch the catalog from the engine, then build the OSDK client against the same origin. Object
// sets are built from the type's name alone, so nothing in this layer is written per type.
import { createClient, type Client } from '@osdk/client';
import { buildCatalog, type RawCatalog } from './catalog.ts';
import type { Catalog } from './types.ts';

export interface DataClient {
  baseUrl: string;
  catalog: Catalog;
  client: Client;
}

// faux hard-codes this token; there is no login. Said plainly in the submission.
const TOKEN = 'myAccessToken';

export async function connect(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<DataClient> {
  const res = await fetchFn(`${baseUrl}/barghest/catalog`);
  if (!res.ok) throw new Error(`engine not reachable at ${baseUrl} (${res.status})`);
  const raw = (await res.json()) as RawCatalog;
  const catalog = buildCatalog(raw);
  const client = createClient(baseUrl, catalog.ontologyRid, async () => TOKEN, undefined, fetchFn);
  return { baseUrl, catalog, client };
}

/** An object set over one type, untyped on purpose: the generic layer works from the catalog, not the SDK. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function objectSet(dc: DataClient, apiName: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return dc.client({ type: 'object', apiName } as any);
}

export async function engineGet<T>(dc: DataClient, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${dc.baseUrl}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}
