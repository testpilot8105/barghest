// The store: one SQLite file through node:sqlite (built into Node 22.13+, no native module to build). Objects are
// kept as faux's server objects, one row per object, so a reload is "register every row". Passages ride in the
// objects table as Passage objects; their embeddings, the audit log and the inference log have tables of their own.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS objects (
  type TEXT NOT NULL,
  pk TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (type, pk)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  outcome TEXT NOT NULL,
  params TEXT NOT NULL,
  edits TEXT NOT NULL,
  object_ids TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inference_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  document_id TEXT,
  passage_id TEXT,
  prompt_hash TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  prompt_tokens INTEGER,
  output_tokens INTEGER,
  ok INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS passage_embedding (
  passage_id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template TEXT,
  blocks TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT NOT NULL DEFAULT '',
  investigation TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved (
  id TEXT PRIMARY KEY,
  investigation TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  folder_id TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export function openStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(SCHEMA);
  // A deleted investigation keeps its row with deleted_at set, so an engine start never recreates a demo one.
  if (!db.prepare('PRAGMA table_info(investigations)').all().some((c) => c.name === 'deleted_at')) db.exec('ALTER TABLE investigations ADD COLUMN deleted_at TEXT');

  const upsertStmt = db.prepare(
    'INSERT INTO objects (type, pk, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(type, pk) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
  );
  const removeStmt = db.prepare('DELETE FROM objects WHERE type = ? AND pk = ?');
  const allStmt = db.prepare('SELECT data FROM objects ORDER BY type, pk');
  const countStmt = db.prepare('SELECT type, COUNT(*) AS n FROM objects GROUP BY type ORDER BY type');
  const auditStmt = db.prepare(
    'INSERT INTO audit_log (at, action, actor, outcome, params, edits, object_ids) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const auditForStmt = db.prepare(
    "SELECT id, at, action, actor, outcome, params, edits, object_ids FROM audit_log WHERE object_ids LIKE ? ORDER BY id",
  );
  const auditAllStmt = db.prepare('SELECT id, at, action, actor, outcome, params, edits, object_ids FROM audit_log ORDER BY id DESC LIMIT 5000');
  const auditRow = (row) => ({
    id: row.id,
    at: row.at,
    action: row.action,
    actor: row.actor,
    outcome: row.outcome,
    params: JSON.parse(row.params),
    edits: JSON.parse(row.edits),
    objectIds: JSON.parse(row.object_ids),
  });
  const inferenceStmt = db.prepare(
    'INSERT INTO inference_log (at, model, purpose, document_id, passage_id, prompt_hash, latency_ms, prompt_tokens, output_tokens, ok) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const inferenceAfterStmt = db.prepare('SELECT * FROM inference_log WHERE id > ? ORDER BY id LIMIT 500');
  const inferenceForStmt = db.prepare('SELECT * FROM inference_log WHERE document_id = ? ORDER BY id');
  const inferenceRow = (row) => ({
    id: row.id,
    at: row.at,
    model: row.model,
    purpose: row.purpose,
    documentId: row.document_id,
    passageId: row.passage_id,
    promptHash: row.prompt_hash,
    latencyMs: row.latency_ms,
    promptTokens: row.prompt_tokens,
    outputTokens: row.output_tokens,
    ok: row.ok === 1,
  });
  const embeddingUpsert = db.prepare(
    'INSERT INTO passage_embedding (passage_id, model, dim, vector) VALUES (?, ?, ?, ?) ON CONFLICT(passage_id) DO UPDATE SET model = excluded.model, dim = excluded.dim, vector = excluded.vector',
  );
  const embeddingsAll = db.prepare('SELECT passage_id, model, dim, vector FROM passage_embedding');
  const embeddingRemove = db.prepare('DELETE FROM passage_embedding WHERE passage_id = ?');
  const investigationUpsert = db.prepare(
    'INSERT INTO investigations (id, name, template, blocks, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, template = excluded.template, blocks = excluded.blocks',
  );
  const investigationGet = db.prepare('SELECT id, name, template, blocks, created_at, deleted_at FROM investigations WHERE id = ? AND deleted_at IS NULL');
  const investigationAny = db.prepare('SELECT id, name, template, blocks, created_at, deleted_at FROM investigations WHERE id = ?');
  const investigationsAll = db.prepare('SELECT id, name, template, blocks, created_at, deleted_at FROM investigations WHERE deleted_at IS NULL ORDER BY created_at, id');
  const investigationMarkDeleted = db.prepare('UPDATE investigations SET deleted_at = ? WHERE id = ?');
  const investigationRow = (row) => (row ? { id: row.id, name: row.name, template: row.template, blocks: JSON.parse(row.blocks), createdAt: row.created_at, deletedAt: row.deleted_at ?? null } : null);
  const folderUpsert = db.prepare(
    'INSERT INTO folders (id, name, parent_id, investigation, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, parent_id = excluded.parent_id',
  );
  const folderGet = db.prepare('SELECT id, name, parent_id, investigation, created_at FROM folders WHERE id = ?');
  const foldersOf = db.prepare('SELECT id, name, parent_id, investigation, created_at FROM folders WHERE investigation = ? ORDER BY parent_id, name, id');
  const folderRemove = db.prepare('DELETE FROM folders WHERE id = ?');
  const folderRow = (row) => (row ? { id: row.id, name: row.name, parentId: row.parent_id, investigation: row.investigation, createdAt: row.created_at } : null);
  const savedUpsert = db.prepare(
    'INSERT INTO saved (id, investigation, kind, name, folder_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, folder_id = excluded.folder_id, body = excluded.body, updated_at = excluded.updated_at',
  );
  const savedGet = db.prepare('SELECT id, investigation, kind, name, folder_id, body, created_at, updated_at FROM saved WHERE id = ?');
  const savedOf = db.prepare('SELECT id, investigation, kind, name, folder_id, created_at, updated_at FROM saved WHERE investigation = ? ORDER BY updated_at DESC, id');
  const savedRemove = db.prepare('DELETE FROM saved WHERE id = ?');
  const savedRow = (row) => {
    if (!row) return null;
    const item = { id: row.id, investigation: row.investigation, kind: row.kind, name: row.name, folderId: row.folder_id, createdAt: row.created_at, updatedAt: row.updated_at };
    if (row.body !== undefined) item.body = JSON.parse(row.body);
    return item;
  };

  return {
    path,
    /** Write one server object (faux shape: __apiName, __primaryKey, __rid, __title, properties). */
    upsert(obj) {
      upsertStmt.run(obj.__apiName, String(obj.__primaryKey), JSON.stringify(obj), new Date().toISOString());
    },
    upsertMany(objs) {
      db.exec('BEGIN');
      try {
        for (const obj of objs) this.upsert(obj);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    remove(type, pk) {
      removeStmt.run(type, String(pk));
    },
    all() {
      return allStmt.all().map((row) => JSON.parse(row.data));
    },
    countByType() {
      return Object.fromEntries(countStmt.all().map((row) => [row.type, Number(row.n)]));
    },
    audit({ action, actor = 'engine', outcome = 'applied', params = {}, edits = [], objectIds = [] }) {
      auditStmt.run(
        new Date().toISOString(),
        action,
        actor,
        outcome,
        JSON.stringify(params),
        JSON.stringify(edits),
        JSON.stringify(objectIds),
      );
    },
    auditFor(objectId) {
      return auditForStmt.all(`%${JSON.stringify(objectId)}%`).map(auditRow);
    },
    /** The newest 5000 audit rows, newest first. */
    auditAll() {
      return auditAllStmt.all().map(auditRow);
    },
    logInference({ model, purpose, documentId = null, passageId = null, promptHash, latencyMs, promptTokens = null, outputTokens = null, ok }) {
      inferenceStmt.run(new Date().toISOString(), model, purpose, documentId, passageId, promptHash, latencyMs, promptTokens, outputTokens, ok ? 1 : 0);
    },
    inferenceLog(after = 0) {
      return inferenceAfterStmt.all(Number(after)).map(inferenceRow);
    },
    /** Every model call made for one document, oldest first. */
    inferenceFor(documentId) {
      return inferenceForStmt.all(String(documentId)).map(inferenceRow);
    },
    putEmbedding(passageId, model, vector) {
      const arr = Float32Array.from(vector);
      embeddingUpsert.run(passageId, model, arr.length, Buffer.from(arr.buffer));
    },
    embeddings() {
      return embeddingsAll.all().map((row) => ({
        passageId: row.passage_id,
        model: row.model,
        vector: new Float32Array(row.vector.buffer, row.vector.byteOffset, row.dim),
      }));
    },
    /** Drop the embeddings of these passages. Returns how many rows went. */
    removeEmbeddings(passageIds) {
      let n = 0;
      for (const id of passageIds) n += Number(embeddingRemove.run(String(id)).changes ?? 0);
      return n;
    },
    /** Investigations live here, outside the ontology: { id, name, template, blocks, createdAt }. */
    putInvestigation({ id, name, template = null, blocks, createdAt }) {
      investigationUpsert.run(id, name, template, JSON.stringify(blocks), createdAt ?? new Date().toISOString());
    },
    /** A live investigation, or null when unknown or deleted. */
    investigation(id) {
      return investigationRow(investigationGet.get(String(id)));
    },
    /** The row whether deleted or not, for the demo check at engine start. */
    investigationEverCreated(id) {
      return investigationRow(investigationAny.get(String(id)));
    },
    investigations() {
      return investigationsAll.all().map(investigationRow);
    },
    markInvestigationDeleted(id) {
      investigationMarkDeleted.run(new Date().toISOString(), String(id));
    },
    /** Folders live here too: { id, name, parentId ('' at the top level), investigation, createdAt }. */
    putFolder({ id, name, parentId = '', investigation, createdAt }) {
      folderUpsert.run(id, name, parentId ?? '', investigation, createdAt ?? new Date().toISOString());
    },
    folder(id) {
      return folderRow(folderGet.get(String(id)));
    },
    folders(investigation) {
      return foldersOf.all(String(investigation)).map(folderRow);
    },
    removeFolder(id) {
      folderRemove.run(String(id));
    },
    /** Saved items (graphs, timelines, conversations, explorations) live here too; the body is JSON the engine never reads. */
    putSaved({ id, investigation, kind, name, folderId = '', body = {}, createdAt, updatedAt }) {
      const now = new Date().toISOString();
      savedUpsert.run(id, investigation, kind, name, folderId ?? '', JSON.stringify(body ?? {}), createdAt ?? now, updatedAt ?? now);
    },
    /** One item with its body, or null. */
    saved(id) {
      return savedRow(savedGet.get(String(id)));
    },
    /** The investigation's items without their bodies, newest change first. */
    savedOf(investigation) {
      return savedOf.all(String(investigation)).map(savedRow);
    },
    removeSaved(id) {
      savedRemove.run(String(id));
    },
    close() {
      db.close();
    },
  };
}
