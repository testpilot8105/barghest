// Folders in Files, the way Compass keeps them: a tree under the open investigation, the path above the list, and one
// menu for a folder wherever it shows (its "…", its right-click, the tree): Open, New folder, Rename, Move to, Delete.
// A folder that holds anything can't be deleted ("Move or delete what's inside first."). Names change in place; the
// id in the address bar never does.
import { Breadcrumbs, Button, Callout, Dialog, DialogBody, DialogFooter, FormGroup, InputGroup, Intent, Menu, MenuDivider, MenuItem, type BreadcrumbProps } from '@blueprintjs/core';
import { FolderClose, Projects } from '@blueprintjs/icons';
import { useState, type CSSProperties } from 'react';
import { createFolder, deleteFolder, EngineError, moveFolder, renameFolder, useDataClient, type FolderEntry } from '../data/index.ts';
import { EMPTY_NAME } from '../intake/parts';
import { toast } from '../intake/toaster';
import { folderHref, navigate } from '../shell/route';

const INSIDE_FIRST = "Move or delete what's inside first.";

/** The folders in tree order: parents before their children, siblings by name, each with its depth. */
export function treeOrder(folders: FolderEntry[]): (FolderEntry & { depth: number })[] {
  const kids = new Map<string, FolderEntry[]>();
  for (const f of folders) kids.set(f.parentId, [...(kids.get(f.parentId) ?? []), f]);
  const out: (FolderEntry & { depth: number })[] = [];
  const walk = (parent: string, depth: number) => {
    for (const f of [...(kids.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ ...f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk('', 0);
  return out;
}

/** The folders from the top level down to `id`; empty at the top level or for a folder that isn't there. */
export function pathTo(folders: FolderEntry[], id: string): FolderEntry[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: FolderEntry[] = [];
  for (let f = byId.get(id); f && path.length < folders.length; f = byId.get(f.parentId)) path.unshift(f);
  return path;
}

/** `id` and every folder under it. */
export function within(folders: FolderEntry[], id: string): Set<string> {
  const ids = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of folders) if (ids.has(f.parentId) && !ids.has(f.id)) (ids.add(f.id), (grew = true));
  }
  return ids;
}

/** The path above the list and the open file: the investigation, then each folder; every step but `current` opens. */
export function FolderCrumbs({ investigation, name, path, linkLast = false }: { investigation: string; name: string | null; path: FolderEntry[]; linkLast?: boolean }) {
  const step = (text: string, folderId: string, last: boolean): BreadcrumbProps => {
    if (last && !linkLast) return { text, current: true };
    const href = folderHref(investigation, folderId);
    return { text, href, onClick: (e) => (e.preventDefault(), navigate(href)) };
  };
  const items = [step(name ?? '', '', !path.length), ...path.map((f, i) => step(f.name, f.id, i === path.length - 1))];
  return <Breadcrumbs className="files__crumbs" items={items} />;
}

/** "Move to", as a submenu: the investigation's top level, then every folder as a tree. */
export function MoveTo({ top, folders, current, exclude, onPick }: { top: string; folders: FolderEntry[]; current: string; exclude?: Set<string>; onPick: (folderId: string) => void }) {
  return (
    <MenuItem text="Move to">
      <MenuItem icon={<Projects />} text={top} disabled={current === ''} onClick={() => onPick('')} />
      {treeOrder(folders).map((f) => (
        <MenuItem
          key={f.id}
          icon={<FolderClose />}
          text={
            <span className="files-move" style={{ '--files-depth': f.depth } as CSSProperties}>
              {f.name}
            </span>
          }
          disabled={f.id === current || exclude?.has(f.id)}
          onClick={() => onPick(f.id)}
        />
      ))}
    </MenuItem>
  );
}

/** Everything a folder can do, for the list, the tree and the path. `here` is the folder open in Files; `holds` says
 * whether a folder has anything in it, from what the list shows, so a full folder's Delete is refused on the spot. */
export function useFolderActions({ investigation, folders, here, holds, reload }: { investigation: string; folders: FolderEntry[]; here: string; holds: (f: FolderEntry) => boolean; reload: () => void }) {
  const { dc } = useDataClient();
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const fail = (e: Error) => toast(e instanceof EngineError ? e.message : 'The engine did not answer.', e instanceof EngineError && e.status === 409 ? Intent.WARNING : Intent.DANGER);

  const rename = (f: FolderEntry, name: string) => dc && renameFolder(dc, f.id, name).then(reload, fail);
  const move = (f: FolderEntry, parentId: string) => dc && moveFolder(dc, f.id, parentId).then(reload, fail);
  const remove = (f: FolderEntry) => {
    if (holds(f)) return toast(INSIDE_FIRST, Intent.WARNING);
    if (!dc) return;
    deleteFolder(dc, f.id).then(() => {
      reload();
      if (within(folders, f.id).has(here)) navigate(folderHref(investigation, f.parentId));
    }, fail);
  };

  /** `where` says which copy of the name turns into a field on Rename: the tree's or the list's. */
  const menu = (f: FolderEntry, top: string, where: 'tree' | 'list') => (
    <Menu className="intake-menu">
      <MenuItem text="Open" onClick={() => navigate(folderHref(investigation, f.id))} />
      <MenuItem text="New folder…" onClick={() => setCreatingIn(f.id)} />
      <MenuItem text="Rename" onClick={() => setRenaming(`${where}:${f.id}`)} />
      <MoveTo top={top} folders={folders} current={f.parentId} exclude={within(folders, f.id)} onPick={(to) => move(f, to)} />
      <MenuDivider />
      <MenuItem text="Delete" intent={Intent.DANGER} onClick={() => remove(f)} />
    </Menu>
  );

  const parent = creatingIn ? folders.find((f) => f.id === creatingIn) : null;
  const dialog = (
    <NewFolderDialog
      isOpen={creatingIn !== null}
      where={parent?.name ?? null}
      onClose={() => setCreatingIn(null)}
      onCreate={(name) =>
        dc
          ? createFolder(dc, { investigation, name, parentId: creatingIn || undefined }).then(() => {
              setCreatingIn(null);
              reload();
            })
          : Promise.resolve()
      }
    />
  );

  return {
    menu,
    dialog,
    /** Whether this folder's name is a field right now, in the tree or the list. */
    isRenaming: (f: FolderEntry, where: 'tree' | 'list') => renaming === `${where}:${f.id}`,
    stopRenaming: () => setRenaming(null),
    rename,
    newFolder: (parentId: string) => setCreatingIn(parentId),
  };
}

/** A name, nothing else, like New investigation. Made inside the folder it was asked from. */
function NewFolderDialog({ isOpen, where, onClose, onCreate }: { isOpen: boolean; where: string | null; onClose: () => void; onCreate: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reset = () => {
    setName('');
    setProblem(null);
    setSaving(false);
  };
  const create = () => {
    if (!name.trim()) return setProblem(EMPTY_NAME);
    setSaving(true);
    onCreate(name.trim()).then(reset, (e: Error) => {
      setSaving(false);
      setProblem(e instanceof EngineError ? e.message : 'The engine did not answer.');
    });
  };
  return (
    <Dialog title={where ? `New folder in ${where}` : 'New folder'} isOpen={isOpen} onClose={onClose} onClosed={reset} className="new-investigation">
      <DialogBody>
        <FormGroup label="Name" labelFor="new-folder-name">
          <InputGroup id="new-folder-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        </FormGroup>
        {problem && <Callout intent={Intent.DANGER}>{problem}</Callout>}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button text="Cancel" onClick={onClose} />
            <Button intent={Intent.PRIMARY} text="Create" loading={saving} onClick={create} />
          </>
        }
      />
    </Dialog>
  );
}
