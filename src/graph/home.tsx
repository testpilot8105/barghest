// The home of Graph and of Timeline, the owner's approved design of 10.10.2026 (the Content file, "BARGHEST Graph home"
// and "BARGHEST Timeline home"): with nothing open, the view lists this investigation's saved graphs or timelines, newest
// change first, laid out like Files. A click opens one; each row's menu opens, renames in place, moves to a folder or
// deletes (asking first); New asks a name and a folder, makes the item and opens it. Graphs and timelines are files
// (the Everything is a file note): plumbing's saved items, section 2.10 of engine-api.md.
import { Alert, Button, Callout, Classes, ContextMenu, Dialog, DialogBody, DialogFooter, FormGroup, InputGroup, Menu, MenuDivider, MenuItem, NonIdealState, Popover, Spinner } from '@blueprintjs/core';
import { CaretDown, Edit, FolderClose, FolderSharedOpen, Graph as GraphIcon, Plus, Search, TimelineEvents, Trash } from '@blueprintjs/icons';
import { useState } from 'react';
import { createSaved, deleteSaved, getObjectView, getSaved, updateSaved, useAsync, useDataClient, useFolders, useInvestigations, useSaved, type SavedItem } from '../data/index.ts';
import { formatCount } from '../explorer/parts';
import { RenameField, RowMenu } from '../intake/parts';
import { findView, paletteVar } from '../shell/nav';
import { navigate, viewHref } from '../shell/route';
import { useDocumentTitle } from '../shell/title';
import { parseKey } from './icons';
import './home.css';

export type HomeKind = 'graph' | 'timeline';

const WORDS: Record<HomeKind, { one: string; many: string; title: string }> = {
  graph: { one: 'graph', many: 'graphs', title: 'Graphs' },
  timeline: { one: 'timeline', many: 'timelines', title: 'Timelines' },
};

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const shortDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function edited(iso: string): string {
  const t = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (t.toDateString() === today.toDateString()) return `Today ${clock.format(t)}`;
  if (t.toDateString() === yesterday.toDateString()) return `Yesterday ${clock.format(t)}`;
  return day.format(t);
}

/** Where a saved item opens. */
export function savedHref(investigation: string, kind: HomeKind, id: string): string {
  return `${viewHref(investigation, kind)}?${new URLSearchParams({ saved: id })}`;
}

interface Described {
  /** Graph: what's on it. Timeline: who it follows. */
  first: string;
  /** Timeline only: the time it covers. */
  second: string;
}

/** What each row says about its item, read from the bodies (the list itself comes without them). */
function useDescriptions(kind: HomeKind, items: SavedItem[]) {
  return useAsync(async (dc) => {
    const titles = new Map<string, string>();
    const titleOf = async (key: string) => {
      if (titles.has(key)) return titles.get(key)!;
      const r = parseKey(key);
      const v = r ? await getObjectView(dc, r.type, r.pk).catch(() => null) : null;
      const t = v?.title ?? r?.pk ?? key;
      titles.set(key, t);
      return t;
    };
    const out = new Map<string, Described>();
    for (const item of items) {
      const body = (await getSaved(dc, item.id).catch(() => null))?.body ?? {};
      if (kind === 'graph') {
        const nodes = Array.isArray(body.nodes) ? body.nodes.length : 0;
        const to = typeof body.to === 'string' && body.to ? await titleOf(body.to) : '';
        const focus = typeof body.focus === 'string' && body.focus ? await titleOf(body.focus) : '';
        const what = nodes ? `${formatCount(nodes)} object${nodes === 1 ? '' : 's'}` : focus ? `Opens on ${focus}` : 'Empty';
        out.set(item.id, { first: to ? `${what} · path to ${to}` : what, second: '' });
      } else {
        const subjects = Array.isArray(body.subjects) ? (body.subjects as unknown[]).filter((s): s is string => typeof s === 'string') : [];
        const names = await Promise.all(subjects.map(titleOf));
        const hops = typeof body.hops === 'number' ? body.hops : 2;
        const from = typeof body.from === 'string' ? Date.parse(body.from) : NaN;
        const until = typeof body.until === 'string' ? Date.parse(body.until) : NaN;
        out.set(item.id, {
          first: names.length ? `${names.join(', ')} · ${hops} hop${hops === 1 ? '' : 's'}` : 'No subject yet',
          second: Number.isFinite(from) && Number.isFinite(until) ? `${shortDay.format(from)} to ${day.format(until)}` : 'Every event',
        });
      }
    }
    return out;
  }, `${kind}|${items.map((i) => `${i.id}@${i.updatedAt}`).join(',')}`);
}

export function SavedHome({ investigation, kind }: { investigation: string; kind: HomeKind }) {
  const w = WORDS[kind];
  const list = useSaved(investigation, kind);
  const folders = useFolders(investigation);
  const investigations = useInvestigations();
  const { dc } = useDataClient();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  useDocumentTitle(`All ${w.many}`);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SavedItem | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const items = list.data?.items ?? [];
  const described = useDescriptions(kind, items);
  const folderName = new Map((folders.data?.folders ?? []).map((f) => [f.id, f.name]));
  const invName = investigations.data?.investigations.find((i) => i.id === investigation)?.name ?? '';
  const q = query.trim().toLowerCase();
  const shown = items.filter((i) => !q || i.name.toLowerCase().includes(q));
  const view = findView(kind);
  const KindIcon = kind === 'graph' ? GraphIcon : TimelineEvents;
  const colour = view ? paletteVar(view.color) : undefined;

  const act = async (fn: () => Promise<unknown>) => {
    if (!dc) return;
    setFailure(null);
    try {
      await fn();
      list.reload();
      folders.reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    }
  };
  const menu = (item: SavedItem) => (
    <Menu>
      <MenuItem icon={<KindIcon />} text="Open" onClick={() => navigate(savedHref(investigation, kind, item.id))} />
      <MenuItem icon={<Edit />} text="Rename" onClick={() => setRenaming(item.id)} />
      <MenuItem icon={<FolderSharedOpen />} text="Move to">
        <MenuItem text="Top level" disabled={!item.folderId} onClick={() => void act(() => updateSaved(dc!, item.id, { folderId: '' }))} />
        {(folders.data?.folders ?? []).map((f) => (
          <MenuItem key={f.id} icon={<FolderClose />} text={f.name} disabled={f.id === item.folderId} onClick={() => void act(() => updateSaved(dc!, item.id, { folderId: f.id }))} />
        ))}
      </MenuItem>
      <MenuDivider />
      <MenuItem icon={<Trash />} intent="danger" text="Delete…" onClick={() => setDeleting(item)} />
    </Menu>
  );

  return (
    <div className="home">
      <div className="home__head">
        <span className="home__title">{w.title}</span>
        <span className={Classes.TEXT_MUTED}>{list.data ? `${invName ? `${invName} · ` : ''}${formatCount(items.length)} ${items.length === 1 ? w.one : w.many}` : ''}</span>
        <span className="home__spacer" />
        <InputGroup className="home__find" leftIcon={<Search />} placeholder={`Find a ${w.one}`} aria-label={`Find a ${w.one}`} value={query} onValueChange={setQuery} />
        <Button intent="primary" icon={<Plus />} text={`New ${w.one}`} onClick={() => setCreating(true)} />
      </div>
      {failure && (
        <Callout intent="danger" compact className="home__failure">
          {failure}
        </Callout>
      )}
      {list.error ? (
        <div className="home__state">
          <Callout intent="danger" compact>
            {list.error.message}
          </Callout>
        </div>
      ) : !list.data ? (
        <div className="home__state">
          <Spinner size={32} />
        </div>
      ) : !items.length ? (
        <div className="home__state">
          <NonIdealState
            icon={<KindIcon size={40} color={colour} />}
            title={`No ${w.many} yet`}
            description={`A ${w.one} is a file in this investigation. Start one from a person, an account or anything else, and it saves itself as you go.`}
            action={<Button intent="primary" icon={<Plus />} text={`New ${w.one}`} onClick={() => setCreating(true)} />}
          />
        </div>
      ) : (
        <div className="home__scroll">
          <table className="home-table">
            <thead>
              <tr>
                {(kind === 'graph' ? ['Name', 'Contents', 'Folder', 'Edited', 'Created', ''] : ['Name', 'Subjects', 'Range', 'Folder', 'Edited', '']).map((h, i) => (
                  <th key={i}>{h && <span className="caps-heading">{h}</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const d = described.data?.get(item.id);
                const folder = item.folderId ? (
                  <span className="home-table__folder">
                    <FolderClose /> {folderName.get(item.folderId) ?? 'Folder'}
                  </span>
                ) : (
                  <span className={Classes.TEXT_MUTED}>Top level</span>
                );
                const pending = <span className={Classes.SKELETON}>loading</span>;
                return (
                  <ContextMenu key={item.id} content={menu(item)} tagName="tr" className="home-table__row" onClick={() => renaming !== item.id && navigate(savedHref(investigation, kind, item.id))}>
                    <td className="home-table__name">
                      <KindIcon color={colour} />
                      {renaming === item.id ? (
                        <span className="home-table__rename">
                          <RenameField value={item.name} onRename={(name) => void act(() => updateSaved(dc!, item.id, { name }))} onDone={() => setRenaming(null)} />
                        </span>
                      ) : (
                        <span>{item.name}</span>
                      )}
                    </td>
                    {kind === 'graph' ? (
                      <>
                        <td>{d ? d.first : pending}</td>
                        <td>{folder}</td>
                        <td className={Classes.TEXT_MUTED}>{edited(item.updatedAt)}</td>
                        <td className={Classes.TEXT_MUTED}>{day.format(new Date(item.createdAt))}</td>
                      </>
                    ) : (
                      <>
                        <td>{d ? d.first : pending}</td>
                        <td className={Classes.TEXT_MUTED}>{d ? d.second : pending}</td>
                        <td>{folder}</td>
                        <td className={Classes.TEXT_MUTED}>{edited(item.updatedAt)}</td>
                      </>
                    )}
                    <td className="home-table__more" onClick={(e) => e.stopPropagation()}>
                      <RowMenu menu={menu(item)} label={item.name} />
                    </td>
                  </ContextMenu>
                );
              })}
            </tbody>
          </table>
          {!shown.length && <p className={`${Classes.TEXT_MUTED} home__none`}>Nothing by that name.</p>}
        </div>
      )}

      <NewDialog
        isOpen={creating}
        kind={kind}
        folders={(folders.data?.folders ?? []).map((f) => ({ id: f.id, name: f.name }))}
        onClose={() => setCreating(false)}
        onCreate={async (name, folderId) => {
          if (!dc) return;
          const item = await createSaved(dc, { investigation, kind, name, folderId, body: {} });
          setCreating(false);
          navigate(savedHref(investigation, kind, item.id));
        }}
      />
      <Alert
        isOpen={!!deleting}
        intent="danger"
        icon={<Trash />}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const item = deleting;
          setDeleting(null);
          if (item) void act(() => deleteSaved(dc!, item.id));
        }}
      >
        <p>
          Delete “{deleting?.name}”? It goes for good. The files and objects it shows stay.
        </p>
      </Alert>
    </div>
  );
}

function NewDialog({ isOpen, kind, folders, onClose, onCreate }: { isOpen: boolean; kind: HomeKind; folders: Array<{ id: string; name: string }>; onClose: () => void; onCreate: (name: string, folderId: string) => Promise<void> }) {
  const w = WORDS[kind];
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const KindIcon = kind === 'graph' ? GraphIcon : TimelineEvents;
  const view = findView(kind);
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim(), folderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`New ${w.one}`} icon={<KindIcon color={view ? paletteVar(view.color) : undefined} />} onClosed={() => (setName(''), setFolderId(''), setError(null))} className="home-dialog">
      <DialogBody>
        <FormGroup label="Name" labelFor="home-new-name">
          <InputGroup id="home-new-name" autoFocus value={name} onValueChange={setName} onKeyDown={(e) => e.key === 'Enter' && void submit()} />
        </FormGroup>
        <FormGroup label="Folder">
          <Popover
            minimal
            placement="bottom-start"
            matchTargetWidth
            content={
              <Menu>
                <MenuItem text="Top level" onClick={() => setFolderId('')} />
                {folders.map((f) => (
                  <MenuItem key={f.id} icon={<FolderClose />} text={f.name} onClick={() => setFolderId(f.id)} />
                ))}
              </Menu>
            }
          >
            <Button fill alignText="start" endIcon={<CaretDown />} text={folders.find((f) => f.id === folderId)?.name ?? 'Top level'} />
          </Popover>
        </FormGroup>
        {error && (
          <Callout intent="danger" compact>
            {error}
          </Callout>
        )}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button text="Cancel" onClick={onClose} />
            <Button intent="primary" text="Create" disabled={!name.trim()} loading={busy} onClick={() => void submit()} />
          </>
        }
      />
    </Dialog>
  );
}
