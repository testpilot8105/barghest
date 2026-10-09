// Graphs and timelines as files (the Everything is a file note, engine-api.md section 2.10). A view with ?saved=<id>
// opens that file and saves every change to it by itself, with no Save button. A link from another view that names an
// object instead (?focus= on Graph, ?object= on Timeline) opens that object's own file, made the first time, so what an
// analyst builds is never left unsaved.
import { Button, Callout, Classes, NonIdealState, Spinner } from '@blueprintjs/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSaved, getObjectView, getSaved, listSaved, updateSaved, useAsync, useDataClient, useSavedItem, type DataClient, type SavedItem } from '../data/index.ts';
import { navigate, viewHref } from '../shell/route';
import { savedHref, type HomeKind } from './home';
import { parseKey } from './icons';
import './home.css';

/** One file, sent back to the view that owns its kind and investigation when the address has either wrong. */
export function useSavedFile(id: string, kind: HomeKind, investigation: string) {
  const item = useSavedItem(id);
  const data = item.data;
  useEffect(() => {
    if (data && (data.kind !== kind || data.investigation !== investigation) && (data.kind === 'graph' || data.kind === 'timeline')) {
      navigate(savedHref(data.investigation, data.kind, data.id), { replace: true });
    }
  }, [data, kind, investigation]);
  return item;
}

export type SaveState = 'saved' | 'saving' | { error: string };

/** Saves a file's body half a second after the last change, one write at a time, and once more on the way out. */
export function useAutosave(id: string) {
  const { dc } = useDataClient();
  const [state, setState] = useState<SaveState>('saved');
  const pending = useRef<Record<string, unknown> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const flush = useCallback(() => {
    const body = pending.current;
    if (!body || !dc) return;
    pending.current = null;
    chain.current = chain.current.then(() =>
      updateSaved(dc, id, { body }).then(
        () => setState(pending.current ? 'saving' : 'saved'),
        (e: unknown) => setState({ error: e instanceof Error ? e.message : String(e) }),
      ),
    );
  }, [dc, id]);
  const save = useCallback(
    (body: Record<string, unknown>) => {
      pending.current = body;
      setState('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 500);
    },
    [flush],
  );
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      flush();
    },
    [flush],
  );
  return { save, state };
}

export function SaveStatus({ state }: { state: SaveState }) {
  if (state === 'saved') return <span className={`${Classes.TEXT_MUTED} file-status`}>Saved</span>;
  if (state === 'saving') return <span className={`${Classes.TEXT_MUTED} file-status`}>Saving…</span>;
  return <span className="file-status file-status--error">Not saved: {state.error}</span>;
}

export function FileLoading() {
  return (
    <div className="home">
      <div className="home__state">
        <Spinner size={32} />
      </div>
    </div>
  );
}

export function FileGone({ investigation, kind, message }: { investigation: string; kind: HomeKind; message: string }) {
  const all = kind === 'graph' ? 'All graphs' : 'All timelines';
  return (
    <div className="home">
      <div className="home__state">
        <NonIdealState title={`This ${kind} can't be opened`} description={message} action={<Button text={all} onClick={() => navigate(viewHref(investigation, kind))} />} />
      </div>
    </div>
  );
}

/** What a link from another view asks for: the file it belongs to (by origin), what goes in it, and its first name. */
export interface FileLink {
  origin: string;
  body: Record<string, unknown>;
  name: (title: (key: string) => Promise<string>) => Promise<string>;
}

// One lookup per link at a time, so a second render never makes a second file.
const opening = new Map<string, Promise<SavedItem>>();

function fileFor(dc: DataClient, investigation: string, kind: HomeKind, link: FileLink): Promise<SavedItem> {
  const k = `${investigation}|${kind}|${link.origin}`;
  let p = opening.get(k);
  if (!p) {
    p = (async () => {
      const { items } = await listSaved(dc, investigation, kind);
      const full = await Promise.all(items.map((i) => getSaved(dc, i.id).catch(() => null)));
      const found = full.find((f) => f?.body?.origin === link.origin);
      if (found) return found;
      const title = async (key: string) => {
        const r = parseKey(key);
        const v = r ? await getObjectView(dc, r.type, r.pk).catch(() => null) : null;
        return v?.title ?? r?.pk ?? key;
      };
      return createSaved(dc, { investigation, kind, name: await link.name(title), body: { ...link.body, origin: link.origin } });
    })().finally(() => setTimeout(() => opening.delete(k), 2000));
    opening.set(k, p);
  }
  return p;
}

/** Opens the file a link from another view belongs to, making it the first time, then swaps the address for it. */
export function OpenFromLink({ investigation, kind, link }: { investigation: string; kind: HomeKind; link: FileLink }) {
  const file = useAsync((dc) => fileFor(dc, investigation, kind, link), `${investigation}|${kind}|${link.origin}`);
  useEffect(() => {
    if (file.data) navigate(savedHref(investigation, kind, file.data.id), { replace: true });
  }, [file.data, investigation, kind]);
  if (file.error) {
    return (
      <div className="home">
        <div className="home__state">
          <Callout intent="danger" compact>
            {file.error.message}
          </Callout>
        </div>
      </div>
    );
  }
  return <FileLoading />;
}
