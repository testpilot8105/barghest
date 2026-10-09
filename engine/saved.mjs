// Saved items: graphs, timelines, conversations and explorations as store records inside one investigation
// (engine-api.md 2.10), the way a Compass resource is a file next to the data. The id is a slug of the first name plus
// a short hash and never changes; the name is a label; the body is JSON the screen of that kind owns and the engine
// never reads. An item never crosses investigations. Every change writes an audit row.
import { folderFor } from './folders.mjs';
import { slugOf } from './investigations.mjs';

export const SAVED_KINDS = ['graph', 'timeline', 'conversation', 'exploration'];

const bad = (message) => Object.assign(new Error(message), { status: 400 });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function requireSaved(store, id) {
  const item = store.saved(id ?? '');
  if (!item) throw notFound(`unknown saved item: ${id}`);
  return item;
}

function requireKind(kind) {
  if (!SAVED_KINDS.includes(kind)) throw bad(`kind must be one of ${SAVED_KINDS.join(', ')}`);
  return kind;
}

/** GET saved: the investigation's items of one kind, or of every kind, newest change first, without bodies. */
export function listSaved(store, investigation, kind = '') {
  const inv = store.investigation(investigation ?? '');
  if (!inv) throw bad(`unknown investigation: ${investigation}`);
  const only = kind ? requireKind(String(kind)) : null;
  const items = store.savedOf(inv.id).filter((s) => !only || s.kind === only);
  return { investigation: inv.id, kind: only, items };
}

/** GET saved-item: one item with its body; 404 when it is gone. */
export function getSaved(store, id) {
  return requireSaved(store, id);
}

export function createSaved(store, { investigation, kind, name, folderId, body } = {}) {
  const inv = store.investigation(investigation ?? '');
  if (!inv) throw bad(`unknown investigation: ${investigation}`);
  requireKind(String(kind ?? ''));
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw bad('name is required');
  const folder = folderFor(store, inv.id, folderId ? String(folderId) : '');
  if (body !== undefined && !isObject(body)) throw bad('body must be a JSON object');
  let id = slugOf(trimmed);
  while (store.saved(id)) id = slugOf(trimmed);
  const now = new Date().toISOString();
  const record = { id, investigation: inv.id, kind, name: trimmed, folderId: folder, body: body ?? {}, createdAt: now, updatedAt: now };
  store.putSaved(record);
  store.audit({
    action: 'createSaved',
    actor: 'analyst',
    params: { id, kind, name: trimmed, folderId: folder, investigation: inv.id },
    edits: [],
    objectIds: [`Saved:${id}`, ...(folder ? [`Folder:${folder}`] : [])],
  });
  return record;
}

/** POST update-saved: any mix of a rename, a new body and a move. Nothing changed, nothing written. */
export function updateSaved(store, { id, name, body, folderId } = {}) {
  const item = requireSaved(store, id);
  const next = { ...item };
  const rows = [];
  if (name !== undefined) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw bad('name is required');
    if (trimmed !== item.name) {
      next.name = trimmed;
      rows.push({ action: 'renameSaved', params: { id: item.id, from: item.name, to: trimmed }, objectIds: [] });
    }
  }
  if (folderId !== undefined) {
    const target = folderFor(store, item.investigation, folderId ? String(folderId) : '');
    if (target !== item.folderId) {
      next.folderId = target;
      rows.push({
        action: 'moveSaved',
        params: { id: item.id, from: item.folderId, to: target },
        objectIds: [...(item.folderId ? [`Folder:${item.folderId}`] : []), ...(target ? [`Folder:${target}`] : [])],
      });
    }
  }
  if (body !== undefined) {
    if (!isObject(body)) throw bad('body must be a JSON object');
    if (JSON.stringify(body) !== JSON.stringify(item.body)) {
      next.body = body;
      rows.push({ action: 'updateSavedBody', params: { id: item.id, kind: item.kind }, objectIds: [] });
    }
  }
  if (!rows.length) return item;
  next.updatedAt = new Date().toISOString();
  store.putSaved(next);
  for (const r of rows) store.audit({ action: r.action, actor: 'analyst', params: r.params, edits: [], objectIds: [`Saved:${item.id}`, ...r.objectIds] });
  return next;
}

export function deleteSaved(store, { id } = {}) {
  const item = requireSaved(store, id);
  store.removeSaved(item.id);
  store.audit({
    action: 'deleteSaved',
    actor: 'analyst',
    params: { id: item.id, kind: item.kind, name: item.name, folderId: item.folderId, investigation: item.investigation },
    edits: [],
    objectIds: [`Saved:${item.id}`, ...(item.folderId ? [`Folder:${item.folderId}`] : [])],
  });
  return { id: item.id, deleted: true };
}
