// Deleting a file: the Document, its passages and rows, everything the model pulled from them, their embeddings and
// the stored copy go; a Relationship shared with another file only loses this file's passage ids; then resolution
// runs again for the investigation without the model, keeping every earlier model decision whose two sides survive.
// The audit row is written first, so the log says what was asked even if a later step throws.
import { rmSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { resolveScenario, rememberedDecisions } from './resolve/index.mjs';

const EVIDENCE_TYPES = new Set(['Document', 'Passage', 'SourceRecord', 'Relationship', 'Resolution']);

/**
 * @param {object} args
 * @param {{ data: any, put(objs: object[]): void }} args.engine
 * @param {object} args.meta ontology.json
 * @param {object} args.store
 * @param {string} args.documentId
 * @param {string} args.filesDir the stored-copies folder (absolute); only a copy under it is ever deleted
 * @param {string} args.root the app folder, which the Document's `path` is relative to
 */
export async function deleteDocument({ engine, meta, store, documentId, filesDir, root }) {
  const data = engine.data;
  const document = data.getObject('Document', documentId);
  if (!document) throw Object.assign(new Error(`document not found: ${documentId}`), { status: 404 });
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
    },
    edits: removing.map((o) => ({ type: 'deleteObject', objectType: o.__apiName, primaryKey: o.__primaryKey })),
    objectIds: removing.map((o) => `${o.__apiName}:${o.__primaryKey}`),
  });

  // Memory and disk, in that order per object, so neither side ever holds what the other dropped.
  for (const o of removing) {
    data.unregisterObjectOrThrow(o.__apiName, o.__primaryKey);
    store.remove(o.__apiName, o.__primaryKey);
  }
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
  const resolved = investigation ? await resolveScenario({ engine, meta, store, scenario: investigation, decide: rememberedDecisions(data) }) : null;

  return {
    documentId,
    removed: { passages: passages.length, records: records.length, mentions: mentions.length, relationships: relationshipsToRemove.length, resolutions: resolutionsToRemove.length, embeddings, storedFile },
    trimmedRelationships: relationshipsToTrim.length,
    resolved: resolved ? { written: resolved.written, repointedRelationships: resolved.repointedRelationships } : null,
  };
}
