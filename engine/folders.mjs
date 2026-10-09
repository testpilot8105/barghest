// Folders: store records inside one investigation, the way Compass folders are not ontology objects. A folder's id
// is a slug of its first name plus a short hash and never changes; its name is a label. A file lives in one folder
// (the Document's folderId, empty at the top level), and folders and files never cross investigations. Every change
// writes an audit row with the old and the new value.
import { slugOf } from './investigations.mjs';

const bad = (message) => Object.assign(new Error(message), { status: 400 });
const conflict = (message) => Object.assign(new Error(message), { status: 409 });

export function requireFolder(store, folderId) {
  const folder = store.folder(folderId);
  if (!folder) throw bad(`unknown folder: ${folderId}`);
  return folder;
}

/** The folder id a file or folder of this investigation may go into: '' is the top level; another investigation's
 * folder is refused. */
export function folderFor(store, investigation, folderId) {
  if (!folderId) return '';
  const folder = requireFolder(store, folderId);
  if (folder.investigation !== investigation) throw bad(`folder ${folderId} belongs to another investigation`);
  return folder.id;
}

const siblingTaken = (store, investigation, parentId, name, exceptId = null) =>
  store.folders(investigation).some((f) => f.parentId === parentId && f.id !== exceptId && f.name.toLowerCase() === name.toLowerCase());

/** Whether `folderId` is `ancestorId` or sits anywhere below it. */
function isWithin(store, folderId, ancestorId) {
  const seen = new Set();
  let current = folderId;
  while (current) {
    if (current === ancestorId) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    current = store.folder(current)?.parentId ?? '';
  }
  return false;
}

/** GET folders: a flat list with direct file and subfolder counts, plus the files at the top level. */
export function listFolders(store, data, investigation) {
  const folders = store.folders(investigation);
  const files = new Map();
  let topLevelFiles = 0;
  for (const d of data.getObjectsOfType('Document')) {
    if (d.scenario !== investigation) continue;
    const f = d.folderId ? String(d.folderId) : '';
    if (!f) topLevelFiles++;
    else files.set(f, (files.get(f) ?? 0) + 1);
  }
  const subfolders = new Map();
  for (const f of folders) if (f.parentId) subfolders.set(f.parentId, (subfolders.get(f.parentId) ?? 0) + 1);
  // Saved items (graphs, timelines, conversations, explorations) sit next to the files (engine-api.md 2.10).
  const saved = new Map();
  let topLevelSaved = 0;
  for (const s of store.savedOf(investigation)) {
    if (!s.folderId) topLevelSaved++;
    else saved.set(s.folderId, (saved.get(s.folderId) ?? 0) + 1);
  }
  return {
    investigation,
    folders: folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, files: files.get(f.id) ?? 0, subfolders: subfolders.get(f.id) ?? 0, saved: saved.get(f.id) ?? 0 })),
    topLevelFiles,
    topLevelSaved,
  };
}

export function createFolder(store, { investigation, name, parentId } = {}) {
  const inv = store.investigation(investigation ?? '');
  if (!inv) throw bad(`unknown investigation: ${investigation}`);
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw bad('name is required');
  const parent = folderFor(store, inv.id, parentId ? String(parentId) : '');
  if (siblingTaken(store, inv.id, parent, trimmed)) throw bad(`a folder named "${trimmed}" is already there`);
  let id = slugOf(trimmed);
  while (store.folder(id)) id = slugOf(trimmed);
  const record = { id, name: trimmed, parentId: parent, investigation: inv.id, createdAt: new Date().toISOString() };
  store.putFolder(record);
  store.audit({
    action: 'createFolder',
    actor: 'analyst',
    params: { folderId: id, name: trimmed, parentId: parent, investigation: inv.id },
    edits: [],
    objectIds: [`Folder:${id}`, ...(parent ? [`Folder:${parent}`] : [])],
  });
  return record;
}

export function renameFolder(store, { folderId, name } = {}) {
  const folder = requireFolder(store, folderId ?? '');
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw bad('name is required');
  if (trimmed === folder.name) return folder;
  if (siblingTaken(store, folder.investigation, folder.parentId, trimmed, folder.id)) throw bad(`a folder named "${trimmed}" is already there`);
  const next = { ...folder, name: trimmed };
  store.putFolder(next);
  store.audit({ action: 'renameFolder', actor: 'analyst', params: { folderId: folder.id, from: folder.name, to: trimmed }, edits: [], objectIds: [`Folder:${folder.id}`] });
  return next;
}

export function moveFolder(store, { folderId, parentId } = {}) {
  const folder = requireFolder(store, folderId ?? '');
  const target = folderFor(store, folder.investigation, parentId ? String(parentId) : '');
  if (target === folder.id) throw bad('a folder cannot be moved into itself');
  if (target && isWithin(store, target, folder.id)) throw bad('a folder cannot be moved into one of its own subfolders');
  if (target === folder.parentId) return folder;
  if (siblingTaken(store, folder.investigation, target, folder.name, folder.id)) throw bad(`a folder named "${folder.name}" is already there`);
  const next = { ...folder, parentId: target };
  store.putFolder(next);
  store.audit({
    action: 'moveFolder',
    actor: 'analyst',
    params: { folderId: folder.id, from: folder.parentId, to: target },
    edits: [],
    objectIds: [`Folder:${folder.id}`, ...(folder.parentId ? [`Folder:${folder.parentId}`] : []), ...(target ? [`Folder:${target}`] : [])],
  });
  return next;
}

export function deleteFolder(store, data, { folderId } = {}) {
  const folder = requireFolder(store, folderId ?? '');
  const me = listFolders(store, data, folder.investigation).folders.find((f) => f.id === folder.id);
  if (me.files || me.subfolders || me.saved) throw conflict("Move or delete what's inside first.");
  store.removeFolder(folder.id);
  store.audit({ action: 'deleteFolder', actor: 'analyst', params: { folderId: folder.id, name: folder.name, parentId: folder.parentId }, edits: [], objectIds: [`Folder:${folder.id}`] });
  return { folderId: folder.id, deleted: true };
}

/** Move a file to a folder of its investigation ('' is the top level). */
export function moveDocument(engine, store, { documentId, folderId } = {}) {
  const doc = engine.data.getObject('Document', documentId ?? '');
  if (!doc) throw Object.assign(new Error(`document not found: ${documentId}`), { status: 404 });
  const target = folderFor(store, doc.scenario, folderId ? String(folderId) : '');
  const from = doc.folderId ? String(doc.folderId) : '';
  if (target === from) return { documentId: String(documentId), folderId: target };
  const next = { ...doc };
  if (target) next.folderId = target;
  else delete next.folderId;
  engine.put([next]);
  store.audit({
    action: 'moveDocument',
    actor: 'analyst',
    params: { documentId, from, to: target },
    edits: [{ type: 'modifyObject', objectType: 'Document', primaryKey: documentId }],
    objectIds: [`Document:${documentId}`, ...(from ? [`Folder:${from}`] : []), ...(target ? [`Folder:${target}`] : [])],
  });
  return { documentId: String(documentId), folderId: target };
}
