// The hooks the screens use. One provider owns the connection; every read hook returns { data, loading, error }
// and re-runs when its inputs change. A small useAsync underneath, nothing from @osdk/react.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { connect, type DataClient } from './client.ts';
import { encodeExploration } from './exploration.ts';
import { countRows, fetchRows, getObjectView, histogram, searchAll, searchAround } from './reads.ts';
import type { Catalog, Exploration, Histogram, ObjectView, Row, SearchAllEntry, SearchAroundEntry } from './types.ts';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface Connection {
  dc: DataClient | null;
  error: Error | null;
}

const ConnectionContext = createContext<Connection>({ dc: null, error: null });

/** Wrap the app in this. It connects to the engine through the app's own origin (Vite proxies /api and /barghest). */
export function BarghestDataProvider({ baseUrl, children }: { baseUrl?: string; children: ReactNode }) {
  const url = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8787');
  const [state, setState] = useState<Connection>({ dc: null, error: null });
  useEffect(() => {
    let live = true;
    connect(url).then(
      (dc) => live && setState({ dc, error: null }),
      (error: Error) => live && setState({ dc: null, error }),
    );
    return () => {
      live = false;
    };
  }, [url]);
  return <ConnectionContext.Provider value={state}>{children}</ConnectionContext.Provider>;
}

export function useDataClient(): Connection {
  return useContext(ConnectionContext);
}

export function useAsync<T>(fn: (dc: DataClient) => Promise<T>, key: string): AsyncState<T> {
  const { dc, error: connectError } = useDataClient();
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!dc) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current(dc).then(
      (data) => live && setState({ data, loading: false, error: null }),
      (error: Error) => live && setState({ data: null, loading: false, error }),
    );
    return () => {
      live = false;
    };
  }, [dc, key]);
  if (connectError) return { data: null, loading: false, error: connectError };
  return state;
}

export function useCatalog(): AsyncState<Catalog> {
  const { dc, error } = useDataClient();
  return { data: dc?.catalog ?? null, loading: !dc && !error, error };
}

export interface RowsState extends AsyncState<Row[]> {
  hasMore: boolean;
  loadMore: () => void;
}

export function useRows(exp: Exploration): RowsState {
  const { dc, error: connectError } = useDataClient();
  const key = encodeExploration(exp);
  const [state, setState] = useState<{ key: string; rows: Row[]; token?: string; loading: boolean; error: Error | null }>({ key, rows: [], loading: true, error: null });
  const load = useCallback(
    (token?: string, append = false) => {
      if (!dc) return;
      setState((s) => ({ ...s, key, loading: true, error: null }));
      fetchRows(dc, exp, token).then(
        (page) => setState((s) => ({ key, rows: append && s.key === key ? [...s.rows, ...page.rows] : page.rows, token: page.nextPageToken, loading: false, error: null })),
        (error: Error) => setState({ key, rows: [], loading: false, error }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dc, key],
  );
  useEffect(() => {
    load();
  }, [load]);
  const loadMore = useCallback(() => {
    if (state.token) load(state.token, true);
  }, [load, state.token]);
  const current = state.key === key ? state : { rows: [], token: undefined, loading: true, error: null };
  return { data: current.rows, loading: current.loading, error: connectError ?? current.error, hasMore: !!current.token, loadMore };
}

export function useCount(exp: Exploration): AsyncState<number> {
  const key = encodeExploration(exp);
  return useAsync((dc) => countRows(dc, exp), key);
}

export function useHistogram(exp: Exploration, property: string | null): AsyncState<Histogram> {
  const key = `${encodeExploration(exp)}|${property ?? ''}`;
  return useAsync(async (dc) => (property ? histogram(dc, exp, property) : Promise.reject(new Error('no property'))), key);
}

export function useSearchAround(exp: Exploration): AsyncState<SearchAroundEntry[]> {
  const key = encodeExploration(exp);
  return useAsync((dc) => searchAround(dc, exp), key);
}

export function useObjectView(type: string | null, pk: string | null): AsyncState<ObjectView> {
  const key = `${type ?? ''}:${pk ?? ''}`;
  return useAsync(async (dc) => (type && pk ? getObjectView(dc, type, pk) : Promise.reject(new Error('no object'))), key);
}

export function useSearchAll(text: string): AsyncState<Record<string, SearchAllEntry>> {
  const q = useMemo(() => text.trim(), [text]);
  return useAsync((dc) => searchAll(dc, q), q);
}
