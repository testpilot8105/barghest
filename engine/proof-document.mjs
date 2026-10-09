// Step 4 proof (pnpm proof:document): the file view in one call, on the dev seed plus a planted mention and a planted
// table row, on a throwaway database with the model off. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '../src/data/client.ts';
import { getDocumentView, importFile } from '../src/data/intake.ts';
import { openStore } from './store.mjs';
import { toServerObject } from './faux.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8793;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-document.sqlite';
const FILES = 'data/proof-document-files';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: FILES };
const meta = JSON.parse(readFileSync(join(root, 'ontology', 'ontology.json'), 'utf8'));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** Beside the seed: one table row on D-001, a Person mention on its first passage, an account mention on the row. */
function plant() {
  const store = openStore(join(root, DB));
  store.upsertMany([
    toServerObject(meta, 'SourceRecord', { recordId: 'SR-001', label: 'messenger-thread.txt row 1', documentId: 'D-001', system: 'PNP-ACG Cyber Forensics', rawJson: '{"from":"Joaquin DP"}', observedAt: '2026-09-13T14:20:00Z' }),
    toServerObject(meta, 'Person', { personId: 'P-m1', fullName: 'Joaquin DP', aliases: [], role: 'mention', passageId: 'PS-001', canonicalId: 'P-001', scenario: 'school-incident' }),
    toServerObject(meta, 'DigitalAccount', { accountId: 'A-m1', handle: 'Joaquin DP', platform: 'Facebook Messenger', recordId: 'SR-001', scenario: 'school-incident' }),
  ]);
  store.close();
}

async function main() {
  clean();
  await run('engine/dev-seed.mjs');
  plant();
  let engine = await startEngine();
  try {
    const dc = await connect(BASE);

    // 1. The document itself
    const view = await getDocumentView(dc, 'D-001');
    check('1 the view carries the Document, not extracting, folder null until step 6', view.document.documentId === 'D-001' && view.document.title.startsWith('Messenger thread') && view.document.status === 'imported' && view.document.extracting === false && view.folder === null, view.document.title);

    // 2. Passages in order with their text and offsets
    check('2 two passages in index order with text and offsets', view.passages.length === 2 && same(view.passages.map((p) => p.pk), ['PS-001', 'PS-002']) && view.passages.every((p) => p.text.length > 0 && p.charEnd > p.charStart), view.passages.map((p) => `${p.pk} ${p.charStart}-${p.charEnd}`).join(', '));

    // 3. The second passage carries the "took" relationship with both ends named as the passage names them
    const r = view.passages[1].relationships;
    check('3 PS-002 carries R-001 "took" from Joaquin Dela Peña to the Glock, with confidence and status', r.length === 1 && r[0].pk === 'R-001' && r[0].kind === 'took' && r[0].from.type === 'Person' && r[0].from.pk === 'P-001' && r[0].from.title === 'Joaquin Dela Peña' && r[0].to.type === 'Firearm' && r[0].to.pk === 'F-001' && /Glock/.test(r[0].to.title) && typeof r[0].confidence === 'number' && r[0].status.length > 0 && r[0].kindLabel === '', r.map((x) => `${x.from.title} ${x.kind} ${x.to.title} (${x.confidence}, ${x.status})`).join('; '));

    // 4. The first passage carries the planted mention, pointing at its canonical person
    const m = view.passages[0].mentions;
    check('4 PS-001 carries the planted mention with its canonical id; PS-002 has none', m.length === 1 && m[0].type === 'Person' && m[0].pk === 'P-m1' && m[0].title === 'Joaquin DP' && m[0].canonicalId === 'P-001' && view.passages[1].mentions.length === 0, m.map((x) => `${x.type} ${x.title} -> ${x.canonicalId}`).join(', '));

    // 5. The table row with its mention
    check('5 the planted row is listed with its observedAt and its account mention', view.records.length === 1 && view.records[0].pk === 'SR-001' && String(view.records[0].observedAt).startsWith('2026-09-13') && view.records[0].mentions.length === 1 && view.records[0].mentions[0].pk === 'A-m1', view.records.map((x) => `${x.pk}: ${x.mentions.map((y) => y.title).join(', ')}`).join('; '));

    // 6. The model log for this document (none: the model is off)
    check('6 the inference log for the document is a list, empty with the model off', Array.isArray(view.inference) && view.inference.length === 0, `${view.inference.length} rows`);

    // 7. The data layer answers exactly what the route answers
    const raw = await (await fetch(`${BASE}/barghest/document?documentId=D-001`)).json();
    check('7 getDocumentView returns the route body unchanged', same(raw, view));

    // 8. Refusals
    const unknown = await fetch(`${BASE}/barghest/document?documentId=D-nope`);
    const missing = await fetch(`${BASE}/barghest/document`);
    check('8 404 for an unknown document, 400 without an id', unknown.status === 404 && missing.status === 400, `${unknown.status} ${missing.status}`);

    // 9. A freshly imported file: its passage, nothing pulled yet; a no-text file: no passages
    const imported = await importFile(dc, { file: new File(['Rowena Dela Peña signed the receipt.'], 'receipt.txt', { type: 'text/plain' }), investigation: 'school-incident', system: 'Proof', extract: false });
    const fresh = await getDocumentView(dc, imported.documentId);
    const blank = await importFile(dc, { file: new File(['\n'], 'blank.txt', { type: 'text/plain' }), investigation: 'school-incident', extract: false });
    const blankView = await getDocumentView(dc, blank.documentId);
    check('9 a fresh import shows its passage with nothing pulled yet; a no-text file shows no passages and says so', fresh.passages.length === 1 && fresh.passages[0].mentions.length === 0 && fresh.passages[0].relationships.length === 0 && fresh.document.extracting === false && blankView.passages.length === 0 && blankView.document.status === 'no text', `${fresh.passages.length} passage(s); blank: ${blankView.document.status}`);

    // 10. After a restart the view is the same
    await stopEngine(engine);
    engine = await startEngine();
    const dc2 = await connect(BASE);
    const after = await getDocumentView(dc2, 'D-001');
    check('10 the view is unchanged after an engine restart', same(after, view));
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
console.log(failed.length ? `proof:document: FAIL (${failed.length} of ${results.length})` : `proof:document: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
