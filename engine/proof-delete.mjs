// Step 5 proof (pnpm proof:delete): deleting a file takes everything the model pulled from it, trims what is shared,
// drops the stored copy, keeps the log, and re-resolves without the model while keeping earlier model decisions. On
// the dev seed plus two imported files with planted mentions, on a throwaway database with the model off.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, engineGet } from '../src/data/client.ts';
import { fetchRows } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';
import { deleteDocument, getDocumentView, importFile } from '../src/data/intake.ts';
import { openStore } from './store.mjs';
import { toServerObject } from './faux.mjs';
import { resolutionIdFor } from './resolve/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8788;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-delete.sqlite';
const FILES = 'data/proof-delete-files';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: FILES };
const meta = JSON.parse(readFileSync(join(root, 'ontology', 'ontology.json'), 'utf8'));
const INV = 'school-incident';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const refused = (promise) => promise.then(() => null, (e) => e);
const eq = (property, value) => ({ filter: { property, op: 'eq', value } });

async function health() {
  try {
    const r = await fetch(`${BASE}/barghest/health`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
async function startEngine() {
  const child = spawn('node', ['engine/server.mjs'], { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 100; i++) {
    if (await health()) return child;
    await sleep(100);
  }
  child.kill();
  throw new Error('engine did not come up on ' + BASE);
}
async function stopEngine(child) {
  if (!child) return;
  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));
}
function run(script) {
  return new Promise((res, rej) => {
    const c = spawn('node', [script], { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
    c.once('exit', (code) => (code === 0 ? res() : rej(new Error(`${script} exited ${code}`))));
  });
}
const clean = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
  rmSync(join(root, FILES), { recursive: true, force: true });
};
const post = (path) => fetch(`${BASE}${path}`, { method: 'POST' });

async function main() {
  clean();
  await run('engine/dev-seed.mjs');
  let engine = await startEngine();
  let a;
  let b;
  try {
    // Two files, model off: alpha goes, beta stays.
    let dc = await connect(BASE);
    a = await importFile(dc, { file: new File(['Rowena Dela Peña met Marco Villarin at the wharf.'], 'alpha.txt', { type: 'text/plain' }), investigation: INV, system: 'Proof', extract: false });
    b = await importFile(dc, { file: new File(['Rowena Dela Peña signed the receipt. R. Dela Peña kept a copy.'], 'beta.txt', { type: 'text/plain' }), investigation: INV, system: 'Proof', extract: false });
    const pa = `${a.documentId}-p0`;
    const pb = `${b.documentId}-p0`;
    await stopEngine(engine);

    // Plant what the model would have pulled: mentions on both passages, one link only here, one shared with the
    // seed's passage, an embedding per passage, one model-log row for alpha.
    let store = openStore(join(root, DB));
    store.upsertMany([
      toServerObject(meta, 'Person', { personId: 'M-ra', fullName: 'Rowena Dela Peña', aliases: [], role: 'mention', passageId: pa, scenario: INV }),
      toServerObject(meta, 'Person', { personId: 'M-mv', fullName: 'Marco Villarin', aliases: [], role: 'mention', passageId: pa, scenario: INV }),
      toServerObject(meta, 'Person', { personId: 'M-rb', fullName: 'Rowena Dela Peña', aliases: [], role: 'mention', passageId: pb, scenario: INV }),
      toServerObject(meta, 'Person', { personId: 'M-rc', fullName: 'R. Dela Peña', aliases: [], role: 'mention', passageId: pb, scenario: INV }),
      toServerObject(meta, 'Relationship', { relationshipId: 'R-only', label: 'Rowena Dela Peña messaged Marco Villarin', kind: 'messaged', fromType: 'Person', fromId: 'M-ra', toType: 'Person', toId: 'M-mv', fromPersonId: 'M-ra', toPersonId: 'M-mv', confidence: 0.95, method: 'extracted', status: 'proposed', passageIds: [pa], recordIds: [], scenario: INV }),
      toServerObject(meta, 'Relationship', { relationshipId: 'R-shared', label: 'Joaquin Dela Peña mentions San Isidro National High School', kind: 'mentions', fromType: 'Person', fromId: 'P-001', toType: 'School', toId: 'S-001', fromPersonId: 'P-001', toSchoolId: 'S-001', confidence: 0.9, method: 'extracted', status: 'proposed', passageIds: [pa, 'PS-002'], recordIds: [], scenario: INV }),
    ]);
    store.putEmbedding(pa, 'nomic-embed-text', [0.1, 0.2, 0.3]);
    store.putEmbedding(pb, 'nomic-embed-text', [0.3, 0.2, 0.1]);
    store.logInference({ model: 'proof', purpose: 'extract', documentId: a.documentId, passageId: pa, promptHash: 'proof', latencyMs: 1, ok: true });
    store.close();

    // Resolve once so the rule merges the two "Rowena Dela Peña" mentions, then record an earlier model decision
    // on the pair that will survive the deletion (beta's two spellings).
    engine = await startEngine();
    const r1 = await (await post(`/barghest/resolve?investigation=${INV}`)).json();
    await stopEngine(engine);
    store = openStore(join(root, DB));
    const keptId = resolutionIdFor('Person', 'M-rb', 'M-rc');
    const kept = store.all().find((o) => o.__apiName === 'Resolution' && o.__primaryKey === keptId);
    store.upsert({ ...kept, decision: 'same', confidence: 0.91, decidedBy: 'local-model', method: 'local-model (planted)', reason: 'an initial for Rowena' });
    store.close();
    engine = await startEngine();
    dc = await connect(BASE);
    const before = await fetchRows(dc, withStep(startExploration('Person'), eq('personId', 'M-rb')));
    const c1 = String(before.rows[0]?.properties.canonicalId ?? '');
    check('0 before: the rule merged the two full spellings into one canonical; the planted model decision is in place', r1.summary.Person.clusters >= 1 && c1.length > 0 && kept?.decidedBy === 'pending', `canonical ${c1}, kept was ${kept?.decidedBy}`);

    // 1. Delete alpha
    const del = await deleteDocument(dc, a.documentId);
    check('1 the reply counts what went: 1 passage, 2 mentions, 1 relationship, 1 embedding, the stored copy; 1 relationship trimmed', del.removed.passages === 1 && del.removed.mentions === 2 && del.removed.relationships === 1 && del.removed.embeddings === 1 && del.removed.storedFile === true && del.trimmedRelationships === 1 && del.resolved !== null, JSON.stringify(del.removed));

    // 2. The document, its passage and its mentions are gone
    const gone = await fetch(`${BASE}/barghest/document?documentId=${a.documentId}`);
    const passage = await fetchRows(dc, withStep(startExploration('Passage'), eq('passageId', pa)));
    const ra = await fetchRows(dc, withStep(startExploration('Person'), eq('personId', 'M-ra')));
    const mv = await fetchRows(dc, withStep(startExploration('Person'), eq('personId', 'M-mv')));
    check('2 the document is 404, its passage and both mentions are gone', gone.status === 404 && passage.rows.length === 0 && ra.rows.length === 0 && mv.rows.length === 0, `${gone.status}, ${passage.rows.length + ra.rows.length + mv.rows.length} left`);

    // 3. The link cited only here is gone; the shared one lost only this file's passage id
    const only = await fetchRows(dc, withStep(startExploration('Relationship'), eq('relationshipId', 'R-only')));
    const shared = await fetchRows(dc, withStep(startExploration('Relationship'), eq('relationshipId', 'R-shared')));
    check('3 R-only is gone; R-shared survives citing PS-002 only', only.rows.length === 0 && shared.rows.length === 1 && same(shared.rows[0].properties.passageIds, ['PS-002']), JSON.stringify(shared.rows[0]?.properties.passageIds));

    // 4. Nothing anywhere carries the deleted passage id
    const carriers = [];
    for (const type of dc.catalog.order) {
      const def = dc.catalog.types[type];
      if (def.entity) {
        const rows = await fetchRows(dc, withStep(startExploration(type), eq('passageId', pa)));
        if (rows.rows.length) carriers.push(`${type}:${rows.rows.length}`);
      }
    }
    const rels = await fetchRows(dc, { ...startExploration('Relationship'), pageSize: 500 });
    const citing = rels.rows.filter((r) => (r.properties.passageIds ?? []).includes(pa));
    const resolutions = await fetchRows(dc, { ...startExploration('Resolution'), pageSize: 500 });
    const naming = resolutions.rows.filter((r) => (r.properties.candidateIds ?? []).includes('Person:M-ra') || (r.properties.candidateIds ?? []).includes('Person:M-mv'));
    check('4 no object, relationship or resolution carries the deleted passage or its mentions', carriers.length === 0 && citing.length === 0 && naming.length === 0, `${carriers.join(', ') || 'no carriers'}, ${citing.length} citing, ${naming.length} naming`);

    // 5. The stored copy is gone; beta's is still there
    check("5 alpha's stored copy is gone, beta's stays", !existsSync(join(root, a.path)) && existsSync(join(root, b.path)), `${a.path} gone, ${b.path} kept`);

    // 6. The audit row and the model-log row
    const audit = await engineGet(dc, '/barghest/audit', { objectId: `Document:${a.documentId}` });
    const deletion = audit.find((row) => row.action === 'deleteDocument');
    const log = await engineGet(dc, '/barghest/inference-log', { after: '0' });
    check('6 the audit row names the deletion by the analyst with what went; the model-log row stays as history', !!deletion && deletion.actor === 'analyst' && deletion.params.title === 'alpha.txt' && deletion.params.mentions === 2 && log.some((row) => row.documentId === a.documentId), `${audit.length} audit rows, ${log.length} log rows`);

    // 7. Resolution ran again without the model: the old canonical is gone, the surviving pair keeps its model decision
    const rb = await fetchRows(dc, withStep(startExploration('Person'), eq('personId', 'M-rb')));
    const c2 = String(rb.rows[0]?.properties.canonicalId ?? '');
    const canonical = c2 ? await fetchRows(dc, withStep(startExploration('Person'), eq('personId', c2))) : { rows: [] };
    const oldCanonical = await fetchRows(dc, withStep(startExploration('Person'), eq('personId', c1)));
    const keptNow = await fetchRows(dc, withStep(startExploration('Resolution'), eq('resolutionId', keptId)));
    const kp = keptNow.rows[0]?.properties ?? {};
    check('7 the old canonical is gone; the beta pair is merged from the kept model decision, not asked again', c2.length > 0 && c2 !== c1 && canonical.rows.length === 1 && oldCanonical.rows.length === 0 && kp.decision === 'same' && kp.decidedBy === 'local-model' && kp.canonicalId === c2, `canonical ${c1} -> ${c2}; kept ${kp.decidedBy} ${kp.decision}`);

    // 8. Refusals
    const unknown = await refused(deleteDocument(dc, 'D-nope'));
    const missing = await post('/barghest/delete-document');
    check('8 404 for an unknown document, 400 without an id', unknown?.status === 404 && missing.status === 400, `${unknown?.status} ${missing.status}`);

    // 9. Deleting the seed's document never touches the pack's own source file
    const packFile = join(root, 'data', INV, 'sources', 'messenger-thread.txt');
    const seedDel = await deleteDocument(dc, 'D-001');
    const r001 = await fetchRows(dc, withStep(startExploration('Relationship'), eq('relationshipId', 'R-001')));
    const seedView = await fetch(`${BASE}/barghest/document?documentId=D-001`);
    check("9 deleting the seed's document removes its passages and R-001 but leaves the pack's source file on disk", seedDel.removed.passages === 2 && seedDel.removed.storedFile === false && r001.rows.length === 0 && seedView.status === 404 && existsSync(packFile), JSON.stringify(seedDel.removed));

    // 10. Embeddings on disk: alpha's gone, beta's kept; and the state survives a restart
    await stopEngine(engine);
    store = openStore(join(root, DB));
    const emb = store.embeddings().map((e) => e.passageId);
    store.close();
    engine = await startEngine();
    const dc2 = await connect(BASE);
    const after = await getDocumentView(dc2, b.documentId);
    const goneStill = await fetch(`${BASE}/barghest/document?documentId=${a.documentId}`);
    check("10 alpha's embedding is gone and beta's kept; after a restart beta is there and alpha is not", same(emb, [pb]) && after.passages.length === 1 && goneStill.status === 404, `embeddings ${emb.join(', ')}`);
  } catch (e) {
    check('no exception', false, e?.message ?? String(e));
    console.error(e);
  } finally {
    await stopEngine(engine);
    clean();
    check('teardown left no proof database and no proof files folder', !existsSync(join(root, DB)) && !existsSync(join(root, FILES)));
  }
}

await main();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:delete: FAIL (${failed.length} of ${results.length})` : `proof:delete: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
