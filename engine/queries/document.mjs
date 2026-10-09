// One call for the file view: the document, its passages each with what the model pulled from them (the mentions
// and relationships that point into the passage), its table rows with their mentions, and its model log. All from
// memory (faux's data store) plus the inference log; nothing here asks the model anything.
const EVIDENCE_TYPES = new Set(['Document', 'Passage', 'SourceRecord', 'Relationship', 'Resolution']);

const plain = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('__')));
const byTitle = (a, b) => a.title.localeCompare(b.title) || a.pk.localeCompare(b.pk);
const byPk = (a, b) => a.pk.localeCompare(b.pk);

/**
 * @param {object} args
 * @param {any} args.data faux's data store
 * @param {object} args.meta ontology.json
 * @param {{ inferenceFor(documentId: string): object[], folder(id: string): object | null }} args.store
 * @param {string} args.documentId
 * @param {boolean} [args.extracting] whether the engine is reading this document right now
 */
export function documentView({ data, meta, store, documentId, extracting = false }) {
  const document = data.getObject('Document', documentId);
  if (!document) throw Object.assign(new Error(`document not found: ${documentId}`), { status: 404 });

  const passages = [...data.getObjectsOfType('Passage')].filter((p) => p.documentId === documentId).sort((a, b) => a.index - b.index);
  const records = [...data.getObjectsOfType('SourceRecord')].filter((r) => r.documentId === documentId).sort((a, b) => String(a.__primaryKey).localeCompare(String(b.__primaryKey)));
  const passageIds = new Set(passages.map((p) => String(p.__primaryKey)));
  const recordIds = new Set(records.map((r) => String(r.__primaryKey)));

  const push = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  // Mentions: every entity whose passageId or recordId points into this file.
  const mentionsByPassage = new Map();
  const mentionsByRecord = new Map();
  for (const type of Object.keys(meta.objectTypes)) {
    if (EVIDENCE_TYPES.has(type)) continue;
    for (const o of data.getObjectsOfType(type)) {
      const mention = { type, pk: String(o.__primaryKey), title: o.__title ?? String(o.__primaryKey), canonicalId: o.canonicalId ? String(o.canonicalId) : null };
      if (o.passageId && passageIds.has(String(o.passageId))) push(mentionsByPassage, String(o.passageId), mention);
      if (o.recordId && recordIds.has(String(o.recordId))) push(mentionsByRecord, String(o.recordId), mention);
    }
  }

  // Relationships: the ones citing a passage of this file, with their ends as the passage names them.
  const titleOf = (type, pk) => (type && pk != null ? data.getObject(type, pk)?.__title ?? String(pk) : String(pk ?? ''));
  const relationshipsByPassage = new Map();
  for (const r of data.getObjectsOfType('Relationship')) {
    const cited = (r.passageIds ?? []).map(String).filter((id) => passageIds.has(id));
    if (!cited.length) continue;
    const view = {
      pk: String(r.__primaryKey),
      kind: String(r.kind ?? ''),
      kindLabel: String(r.kindLabel ?? ''),
      label: r.__title ?? String(r.__primaryKey),
      from: { type: String(r.fromType ?? ''), pk: String(r.fromId ?? ''), title: titleOf(r.fromType, r.fromId) },
      to: { type: String(r.toType ?? ''), pk: String(r.toId ?? ''), title: titleOf(r.toType, r.toId) },
      confidence: r.confidence == null ? null : Number(r.confidence),
      status: String(r.status ?? ''),
      method: String(r.method ?? ''),
    };
    for (const id of cited) push(relationshipsByPassage, id, view);
  }

  const folder = document.folderId ? store.folder(String(document.folderId)) : null;

  // A photo: its metadata and what the analyst says it shows (engine-api.md 2.11); null and empty for other files.
  const isPhoto = document.status === 'photo';
  const photo = isPhoto
    ? Object.fromEntries(['takenAt', 'latitude', 'longitude', 'cameraMake', 'cameraModel', 'width', 'height', 'orientation'].map((k) => [k, document[k] ?? null]))
    : null;
  const depicts = isPhoto
    ? [...data.getObjectsOfType('Relationship')]
        .filter((r) => r.kind === 'depicts' && r.fromType === 'Document' && String(r.fromId) === String(documentId))
        .map((r) => ({ type: String(r.toType), pk: String(r.toId), title: titleOf(r.toType, r.toId) }))
        .sort(byTitle)
    : [];

  return {
    document: { ...plain(document), extracting },
    folder: folder ? { id: folder.id, name: folder.name } : null,
    photo,
    depicts,
    passages: passages.map((p) => {
      const pk = String(p.__primaryKey);
      return {
        pk,
        index: Number(p.index ?? 0),
        text: String(p.text ?? ''),
        charStart: Number(p.charStart ?? 0),
        charEnd: Number(p.charEnd ?? 0),
        mentions: (mentionsByPassage.get(pk) ?? []).sort(byTitle),
        relationships: (relationshipsByPassage.get(pk) ?? []).sort(byPk),
      };
    }),
    records: records.map((r) => {
      const pk = String(r.__primaryKey);
      return { pk, label: r.__title ?? pk, observedAt: r.observedAt ?? null, system: String(r.system ?? ''), mentions: (mentionsByRecord.get(pk) ?? []).sort(byTitle) };
    }),
    inference: store.inferenceFor(documentId),
  };
}
