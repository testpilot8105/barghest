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

/** A refused or failed engine call: the HTTP status and the engine's own message, so a screen can say why. */
export class EngineError extends Error {
  status: number;
  path: string;
  constructor(path: string, status: number, message: string) {
    super(message);
    this.name = 'EngineError';
    this.status = status;
    this.path = path;
  }
}

async function engineResponse<T>(path: string, res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${path}: ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // not JSON: keep the status message
    }
    throw new EngineError(path, res.status, message);
  }
  return (await res.json()) as T;
}

function engineUrl(dc: DataClient, path: string, params: Record<string, string>): URL {
  const url = new URL(`${dc.baseUrl}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

export async function engineGet<T>(dc: DataClient, path: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(engineUrl(dc, path, params));
  return engineResponse<T>(path, res);
}

/** POST to the engine: a FormData body goes as multipart, anything else as JSON, nothing as an empty body. */
export async function enginePost<T>(dc: DataClient, path: string, params: Record<string, string> = {}, body?: FormData | Record<string, unknown>): Promise<T> {
  const init: RequestInit = { method: 'POST' };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  const res = await fetch(engineUrl(dc, path, params), init);
  return engineResponse<T>(path, res);
}
