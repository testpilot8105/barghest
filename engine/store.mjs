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
`;

export function openStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(SCHEMA);

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
  const embeddingUpsert = db.prepare(
    'INSERT INTO passage_embedding (passage_id, model, dim, vector) VALUES (?, ?, ?, ?) ON CONFLICT(passage_id) DO UPDATE SET model = excluded.model, dim = excluded.dim, vector = excluded.vector',
  );
  const embeddingsAll = db.prepare('SELECT passage_id, model, dim, vector FROM passage_embedding');

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
      return inferenceAfterStmt.all(Number(after)).map((row) => ({
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
      }));
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
    close() {
      db.close();
    },
  };
}
