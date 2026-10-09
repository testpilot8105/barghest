// Deleting a file: the Document, its passages and rows, everything the model pulled from them, their embeddings and
// the stored copy go; a Relationship shared with another file only loses this file's passage ids; then resolution
// runs again for the investigation without the model, keeping every earlier model decision whose two sides survive.
// The audit row is written first, so the log says what was asked even if a later step throws.
import { readFileSync, rmSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { resolveScenario, rememberedDecisions } from './resolve/index.mjs';
import { folderFor } from './folders.mjs';
import { clearPicturesOf } from './images.mjs';
import { ingestFile } from './ingest/index.mjs';

const EVIDENCE_TYPES = new Set(['Document', 'Passage', 'SourceRecord', 'Relationship', 'Resolution']);
const bad = (message) => Object.assign(new Error(message), { status: 400 });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });
const requireDocument = (data, documentId) => {
  const doc = data.getObject('Document', documentId ?? '');
  if (!doc) throw notFound(`document not found: ${documentId}`);
  return doc;
};
const shownName = (doc) => String(doc.name ?? doc.title ?? doc.__primaryKey);
const shownRegister = (doc) => String(doc.register ?? doc.system ?? '');

/**
 * @param {object} args
 * @param {{ data: any, put(objs: object[]): void }} args.engine
 * @param {object} args.meta ontology.json
 * @param {object} args.store
 * @param {string} args.documentId
 * @param {string} args.filesDir the stored-copies folder (absolute); only a copy under it is ever deleted
 * @param {string} args.root the app folder, which the Document's `path` is relative to
 * @param {boolean} [args.resolve] run resolution again afterwards (off when a whole investigation goes)
 */
export async function deleteDocument({ engine, meta, store, documentId, filesDir, root, resolve: resolveAfter = true }) {
  const data = engine.data;
  const document = requireDocument(data, documentId);
  const investigation = document.scenario;

  const passages = [...data.getObjectsOfType('Passage')].filter((p) => p.documentId === documentId);
  const records = [...data.getObjectsOfType('SourceRecord')].filter((r) => r.documentId === documentId);
  const passageIds = new Set(passages.map((p) => String(p.__primaryKey)));
  const recordIds = new Set(records.map((r) => String(r.__primaryKey)));

  // Everything the model pulled from this file.
  const mentions = [];
  for (const type of Object.keys(meta.objectTypes)) {
    if (EVIDENCE_TYPES.has(type)) continue;
    for (const o of data.getObjectsOfType(type)) {
      if ((o.passageId && passageIds.has(String(o.passageId))) || (o.recordId && recordIds.has(String(o.recordId)))) mentions.push(o);
    }
  }
  const mentionIds = new Set(mentions.map((m) => `${m.__apiName}:${m.__primaryKey}`));

  // Relationships: cited only here go; shared ones lose this file's passage ids; ends on a deleted mention go too.
  const relationshipsToRemove = [];
  const relationshipsToTrim = [];
  for (const r of data.getObjectsOfType('Relationship')) {
    const cited = (r.passageIds ?? []).map(String);
    const here = cited.filter((id) => passageIds.has(id));
    const endsHere = mentionIds.has(`${r.fromType}:${r.fromId}`) || mentionIds.has(`${r.toType}:${r.toId}`);
    if (!here.length && !endsHere) continue;
    const left = cited.filter((id) => !passageIds.has(id));
    const recordsLeft = (r.recordIds ?? []).map(String).filter((id) => !recordIds.has(id));
    if (endsHere || (left.length === 0 && recordsLeft.length === 0)) relationshipsToRemove.push(r);
    else relationshipsToTrim.push({ ...r, passageIds: left, recordIds: recordsLeft });
  }

  // Resolutions that name a deleted mention are stale; the re-run below rewrites the rest.
  const resolutionsToRemove = [...data.getObjectsOfType('Resolution')].filter((rs) => (rs.candidateIds ?? []).some((id) => mentionIds.has(String(id))));

  // A photo: every object whose picture it was gets another linked photo or none (its `depicts` links go with
  // the photo's passage above).
  const picturesCleared = document.status === 'photo' ? clearPicturesOf({ engine, data, documentId: String(documentId) }) : [];

  const removing = [document, ...passages, ...records, ...mentions, ...relationshipsToRemove, ...resolutionsToRemove];
  store.audit({
    action: 'deleteDocument',
    actor: 'analyst',
    outcome: 'applied',
    params: {
      documentId,
      title: document.title,
      path: document.path,
      investigation,
      passages: passages.length,
      records: records.length,
      mentions: mentions.length,
      relationshipsRemoved: relationshipsToRemove.length,
      relationshipsTrimmed: relationshipsToTrim.length,
      resolutionsRemoved: resolutionsToRemove.length,
      picturesCleared,
    },
    edits: removing.map((o) => ({ type: 'deleteObject', objectType: o.__apiName, primaryKey: o.__primaryKey })),
    objectIds: removing.map((o) => `${o.__apiName}:${o.__primaryKey}`),
  });

  // Memory and disk, in that order per object, so neither side ever holds what the other dropped.
  for (const o of removing) engine.remove(o.__apiName, o.__primaryKey);
  if (relationshipsToTrim.length) engine.put(relationshipsToTrim);
  const embeddings = store.removeEmbeddings([...passageIds]);

  // The stored copy, only when it is one (a pack's own source file under data/<investigation>/sources/ stays).
  let storedFile = false;
  const file = resolve(root, String(document.path ?? ''));
  if (file.startsWith(filesDir + sep)) {
    try {
      if (statSync(file).isFile()) {
        rmSync(file, { force: true });
        storedFile = true;
      }
    } catch {
      // already gone
    }
  }

  // Resolution again, without the model: earlier model decisions are reused where both sides survive.
  const resolved = investigation && resolveAfter ? await resolveScenario({ engine, meta, store, scenario: investigation, decide: rememberedDecisions(data) }) : null;

  return {
    documentId,
    removed: { passages: passages.length, records: records.length, mentions: mentions.length, relationships: relationshipsToRemove.length, resolutions: resolutionsToRemove.length, embeddings, storedFile },
    trimmedRelationships: relationshipsToTrim.length,
    resolved: resolved ? { written: resolved.written, repointedRelationships: resolved.repointedRelationships } : null,
  };
}

/** Rename the shown name; the title the file came in with stays. The original extension is kept. */
export function renameDocument(engine, store, { documentId, name } = {}) {
  const doc = requireDocument(engine.data, documentId);
  let next = String(name ?? '').trim();
  if (!next) throw bad('name is required');
  const ext = /\.([A-Za-z0-9]+)$/.exec(String(doc.title ?? ''))?.[0] ?? '';
  if (ext && !next.toLowerCase().endsWith(ext.toLowerCase())) next += ext;
  const from = shownName(doc);
  if (next !== from) {
    engine.put([{ ...doc, name: next }]);
    store.audit({ action: 'renameDocument', actor: 'analyst', params: { documentId, from, to: next }, edits: [{ type: 'modifyObject', objectType: 'Document', primaryKey: documentId }], objectIds: [`Document:${documentId}`] });
  }
  return { documentId: String(documentId), name: next, title: String(doc.title ?? '') };
}

/** Change the shown register of one file; the system it came from stays. Empty means no register. */
export function setRegister(engine, store, { documentId, register } = {}) {
  const doc = requireDocument(engine.data, documentId);
  const next = String(register ?? '').trim();
  const from = shownRegister(doc);
  if (next !== from) {
    const updated = { ...doc };
    if (next) updated.register = next;
    else delete updated.register;
    engine.put([updated]);
    store.audit({ action: 'setRegister', actor: 'analyst', params: { documentId, from, to: next }, edits: [{ type: 'modifyObject', objectType: 'Document', primaryKey: documentId }], objectIds: [`Document:${documentId}`] });
  }
  return { documentId: String(documentId), register: next, system: String(doc.system ?? '') };
}

/** Rename a register on every file of the investigation that carries it (the group row in Data Sources). */
export function renameRegister(engine, store, { investigation, from, to } = {}) {
  const inv = store.investigation(investigation ?? '');
  if (!inv) throw bad(`unknown investigation: ${investigation}`);
  const was = String(from ?? '').trim();
  const next = String(to ?? '').trim();
  if (!next) throw bad('to is required');
  const docs = [...engine.data.getObjectsOfType('Document')].filter((d) => d.scenario === inv.id && shownRegister(d) === was);
  if (docs.length && next !== was) {
    engine.put(docs.map((d) => ({ ...d, register: next })));
    store.audit({
      action: 'renameRegister',
      actor: 'analyst',
      params: { investigation: inv.id, from: was, to: next, documents: docs.length },
      edits: docs.map((d) => ({ type: 'modifyObject', objectType: 'Document', primaryKey: d.__primaryKey })),
      objectIds: [`Investigation:${inv.id}`, ...docs.map((d) => `Document:${d.__primaryKey}`)],
    });
  }
  return { investigation: inv.id, from: was, to: next, documents: docs.length };
}

/**
 * Move a file to another investigation: removed here (as deleteDocument), imported there from its stored copy into
 * the chosen folder, keeping its shown name and register. The model then reads it again there, so `start` is the
 * engine's extraction starter; `extract: false` stores it without reading.
 */
export async function moveDocumentToInvestigation({ engine, meta, store, llm, documentId, investigation, folderId, extract, filesDir, root, start }) {
  const data = engine.data;
  const doc = requireDocument(data, documentId);
  const target = store.investigation(investigation ?? '');
  if (!target) throw bad(`unknown investigation: ${investigation}`);
  if (target.id === doc.scenario) throw bad('the file is already in that investigation');
  const folder = folderFor(store, target.id, folderId ? String(folderId) : '');
  const file = resolve(root, String(doc.path ?? ''));
  const inside = file.startsWith(root + sep);
  const stat = inside ? (() => { try { return statSync(file); } catch { return null; } })() : null;
  if (!stat?.isFile()) throw notFound(`no stored copy for ${documentId}`);
  const buffer = readFileSync(file);
  const keep = { title: String(doc.title ?? ''), system: String(doc.system ?? ''), name: shownName(doc), register: shownRegister(doc), from: String(doc.scenario ?? '') };

  await deleteDocument({ engine, meta, store, documentId, filesDir, root });
  const result = await ingestFile({ engine, meta, store, scenario: target.id, filename: keep.title, buffer, system: keep.system, folderId: folder, filesDir, root });
  const fresh = data.getObject('Document', result.documentId);
  const shown = { ...fresh, name: keep.name };
  if (keep.register) shown.register = keep.register;
  else delete shown.register;
  engine.put([shown]);
  const extraction = result.status === 'no text' ? 'no text' : result.status === 'photo' ? 'photo' : llm.allowed() && extract !== false ? start(result.documentId, target.id) : 'off';
  store.audit({
    action: 'moveDocumentToInvestigation',
    actor: 'analyst',
    params: { from: keep.from, to: target.id, previousDocumentId: documentId, documentId: result.documentId, folderId: folder, name: keep.name, register: keep.register, passages: result.passages },
    edits: [{ type: 'addObject', objectType: 'Document', primaryKey: result.documentId }],
    objectIds: [`Document:${documentId}`, `Document:${result.documentId}`, `Investigation:${keep.from}`, `Investigation:${target.id}`],
  });
  return { documentId: result.documentId, previousDocumentId: String(documentId), investigation: target.id, folderId: folder, passages: result.passages, extraction };
}

/** Delete an investigation: every file as deleteDocument, every object left with its id, its folders, the record. */
export async function deleteInvestigation({ engine, meta, store, investigation, filesDir, root, jobs }) {
  const inv = store.investigation(investigation ?? '');
  if (!inv) throw notFound(`unknown investigation: ${investigation}`);
  const data = engine.data;
  const docs = [...data.getObjectsOfType('Document')].filter((d) => d.scenario === inv.id);
  if (docs.some((d) => jobs.has(String(d.__primaryKey)))) throw Object.assign(new Error('a file of this investigation is still being read; wait for it to finish'), { status: 409 });

  for (const d of docs) await deleteDocument({ engine, meta, store, documentId: String(d.__primaryKey), filesDir, root, resolve: false });

  // Whatever still carries the id: canonical objects, resolutions, relationships, anything derived.
  const leftovers = [];
  for (const type of Object.keys(meta.objectTypes)) for (const o of data.getObjectsOfType(type)) if (o.scenario === inv.id) leftovers.push(o);
  for (const o of leftovers) engine.remove(o.__apiName, o.__primaryKey);
  const folders = store.folders(inv.id);
  for (const f of folders) store.removeFolder(f.id);
  // Its saved items (graphs, timelines, conversations, explorations) go with it (engine-api.md 2.10).
  const saved = store.savedOf(inv.id);
  for (const s of saved) store.removeSaved(s.id);
  store.markInvestigationDeleted(inv.id);
  store.audit({
    action: 'deleteInvestigation',
    actor: 'analyst',
    params: { investigation: inv.id, name: inv.name, documents: docs.length, folders: folders.length, saved: saved.length, objects: leftovers.length },
    edits: leftovers.map((o) => ({ type: 'deleteObject', objectType: o.__apiName, primaryKey: o.__primaryKey })),
    objectIds: [`Investigation:${inv.id}`, ...folders.map((f) => `Folder:${f.id}`), ...saved.map((s) => `Saved:${s.id}`)],
  });
  return { investigation: inv.id, deleted: true, documents: docs.length, folders: folders.length, saved: saved.length, objects: leftovers.length };
}
