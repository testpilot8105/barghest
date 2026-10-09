// A photo in the ontology (engine-api.md 2.11): the analyst says "this photo shows this object". That is a
// Relationship of kind `depicts` from the Document to the object, method analyst, confirmed, confidence 1, observed
// at the date taken, with the photo's one passage as its evidence. The object's picture, the one its graph node
// shows, is the ontology-owned `photoId` every entity type carries; the first linked photo becomes it until someone
// changes it. Every change writes an audit row. The model is never involved.
import { createHash } from 'node:crypto';
import { toServerObject } from './faux.mjs';
import { isImageFormat } from './ingest/photo.mjs';

const EVIDENCE_TYPES = new Set(['Document', 'Passage', 'SourceRecord', 'Relationship', 'Resolution']);
const bad = (message) => Object.assign(new Error(message), { status: 400 });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });

export const depictsId = (documentId, type, pk) => `R-${createHash('sha1').update(`depicts|${documentId}|${type}:${pk}`).digest('hex').slice(0, 8)}`;

function requirePhoto(data, documentId) {
  const doc = data.getObject('Document', documentId ?? '');
  if (!doc) throw notFound(`document not found: ${documentId}`);
  if (doc.status !== 'photo' && !isImageFormat(doc.format)) throw bad(`${doc.name ?? doc.title ?? documentId} is not a photo`);
  return doc;
}

function requireEntity(data, meta, objectId) {
  const m = /^([A-Za-z]+):(.+)$/.exec(String(objectId ?? ''));
  if (!m) throw bad('objectId must be Type:pk');
  const [, type, pk] = m;
  if (!meta.objectTypes[type] || EVIDENCE_TYPES.has(type)) throw bad(`${type} cannot carry a photo`);
  const obj = data.getObject(type, pk);
  if (!obj) throw notFound(`object not found: ${objectId}`);
  return { type, pk, obj };
}

const passageOf = (data, documentId) => [...data.getObjectsOfType('Passage')].find((p) => p.documentId === documentId) ?? null;
const shownName = (doc) => String(doc.name ?? doc.title ?? doc.__primaryKey);

/** Every `depicts` link pointing at an object, newest photo first. */
export function photosOf(data, type, pk) {
  return [...data.getObjectsOfType('Relationship')]
    .filter((r) => r.kind === 'depicts' && r.fromType === 'Document' && r.toType === type && String(r.toId) === String(pk))
    .sort((a, b) => String(b.observedAt ?? '').localeCompare(String(a.observedAt ?? '')) || String(a.__primaryKey).localeCompare(String(b.__primaryKey)));
}

function writePhotoId(engine, obj, photoId) {
  const next = { ...obj };
  if (photoId) next.photoId = photoId;
  else delete next.photoId;
  engine.put([next]);
  return next;
}

export function linkImage({ engine, meta, store, documentId, objectId }) {
  const data = engine.data;
  const doc = requirePhoto(data, documentId);
  const { type, pk, obj } = requireEntity(data, meta, objectId);
  if (obj.scenario && doc.scenario && obj.scenario !== doc.scenario) throw bad(`${objectId} belongs to another investigation`);
  const relationshipId = depictsId(String(doc.__primaryKey), type, pk);
  const existing = data.getObject('Relationship', relationshipId);
  if (existing) return existing;
  const passage = passageOf(data, String(doc.__primaryKey));
  const relationship = toServerObject(meta, 'Relationship', {
    relationshipId,
    label: `${shownName(doc)} shows ${obj.__title ?? pk}`,
    kind: 'depicts',
    fromType: 'Document',
    fromId: String(doc.__primaryKey),
    toType: type,
    toId: pk,
    fromDocumentId: String(doc.__primaryKey),
    [`to${type}Id`]: pk,
    observedAt: doc.takenAt ?? undefined,
    confidence: 1,
    method: 'analyst',
    status: 'confirmed',
    passageIds: passage ? [String(passage.__primaryKey)] : [],
    recordIds: [],
    scenario: doc.scenario,
  });
  engine.put([relationship]);
  const becamePhoto = !obj.photoId;
  if (becamePhoto) writePhotoId(engine, obj, String(doc.__primaryKey));
  store.audit({
    action: 'linkImage',
    actor: 'analyst',
    params: { documentId: String(doc.__primaryKey), objectId: `${type}:${pk}`, relationshipId, becamePhoto },
    edits: [{ type: 'addObject', objectType: 'Relationship', primaryKey: relationshipId }, ...(becamePhoto ? [{ type: 'modifyObject', objectType: type, primaryKey: pk }] : [])],
    objectIds: [`Relationship:${relationshipId}`, `Document:${doc.__primaryKey}`, `${type}:${pk}`],
  });
  return data.getObject('Relationship', relationshipId);
}

/** The picture an object is left with when `goneId` stops being one: another linked photo, or none. */
function fallbackPhoto(data, type, pk, goneId) {
  const other = photosOf(data, type, pk).find((r) => String(r.fromId) !== String(goneId));
  return other ? String(other.fromId) : '';
}

export function unlinkImage({ engine, meta, store, documentId, objectId }) {
  const data = engine.data;
  const { type, pk, obj } = requireEntity(data, meta, objectId);
  const relationshipId = depictsId(String(documentId ?? ''), type, pk);
  const relationship = data.getObject('Relationship', relationshipId);
  if (!relationship) throw notFound(`${documentId} is not linked to ${objectId}`);
  engine.remove('Relationship', relationshipId);
  let photoId = obj.photoId ? String(obj.photoId) : '';
  if (photoId === String(documentId)) {
    photoId = fallbackPhoto(data, type, pk, documentId);
    writePhotoId(engine, obj, photoId);
  }
  store.audit({
    action: 'unlinkImage',
    actor: 'analyst',
    params: { documentId: String(documentId), objectId: `${type}:${pk}`, relationshipId, photoId },
    edits: [{ type: 'deleteObject', objectType: 'Relationship', primaryKey: relationshipId }],
    objectIds: [`Relationship:${relationshipId}`, `Document:${documentId}`, `${type}:${pk}`],
  });
  return { documentId: String(documentId), objectId: `${type}:${pk}`, unlinked: true, photoId };
}

export function setPhoto({ engine, meta, store, objectId, documentId }) {
  const data = engine.data;
  const { type, pk, obj } = requireEntity(data, meta, objectId);
  const from = obj.photoId ? String(obj.photoId) : '';
  let to = '';
  if (documentId) {
    const doc = requirePhoto(data, documentId);
    to = String(doc.__primaryKey);
    if (!data.getObject('Relationship', depictsId(to, type, pk))) linkImage({ engine, meta, store, documentId: to, objectId: `${type}:${pk}` });
  }
  const current = data.getObject(type, pk);
  if ((current.photoId ? String(current.photoId) : '') !== to) writePhotoId(engine, current, to);
  if (from !== to) {
    store.audit({
      action: 'setPhoto',
      actor: 'analyst',
      params: { objectId: `${type}:${pk}`, from, to },
      edits: [{ type: 'modifyObject', objectType: type, primaryKey: pk }],
      objectIds: [`${type}:${pk}`, ...(from ? [`Document:${from}`] : []), ...(to ? [`Document:${to}`] : [])],
    });
  }
  return { objectId: `${type}:${pk}`, photoId: to };
}

/**
 * Before a photo is deleted: every object whose picture it is gets another linked photo or none. Returns what was
 * cleared, for the delete's audit row. The `depicts` links themselves go with the photo's passage.
 */
export function clearPicturesOf({ engine, data, documentId }) {
  const cleared = [];
  for (const r of [...data.getObjectsOfType('Relationship')]) {
    if (r.kind !== 'depicts' || String(r.fromId) !== String(documentId)) continue;
    const obj = data.getObject(r.toType, r.toId);
    if (!obj || String(obj.photoId ?? '') !== String(documentId)) continue;
    const photoId = fallbackPhoto(data, r.toType, r.toId, documentId);
    writePhotoId(engine, obj, photoId);
    cleared.push({ objectId: `${r.toType}:${r.toId}`, photoId });
  }
  return cleared;
}
