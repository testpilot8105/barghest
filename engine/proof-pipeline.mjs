// Whole-pipeline proof with the local model (BARGHEST_OLLAMA=on pnpm proof:pipeline): three small fictional files
// go through import, extraction, resolution (the model deciding the unsure pairs), embeddings, semantic search and
// one question with citations, against the engine on a throwaway database. Memory is sampled along the way.
// Needs Ollama running with qwen3:4b-instruct and nomic-embed-text pulled. Exit 1 on any failure.
import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '../src/data/client.ts';
import { fetchRows, getObjectView } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8794;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-pipeline.sqlite';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'on' };

const results = [];
const t0 = Date.now();
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const since = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
function freeMemory() {
  try {
    return execSync('memory_pressure', { encoding: 'utf8' }).match(/free percentage:\s*(\d+%)/i)?.[1] ?? '?';
  } catch {
    return '?';
  }
}
const mem = [];
const sample = (label) => mem.push(`${label} ${since()} free ${freeMemory()}`);

async function health() {
  try {
    const r = await fetch(`${BASE}/barghest/health`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
async function startEngine() {
  const child = spawn('node', ['engine/server.mjs'], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'] });
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
const cleanDb = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
};
const post = (path, body, json = false) =>
  fetch(`${BASE}${path}`, { method: 'POST', body: json ? JSON.stringify(body) : body, headers: json ? { 'content-type': 'application/json' } : undefined }).then(async (r) => ({ status: r.status, body: await r.json() }));
const get = (path) => fetch(`${BASE}${path}`).then((r) => r.json());

// ---- Fixtures: fictional, in the registers' own wording, the same student spelled three ways.
const fixtures = mkdtempSync(join(tmpdir(), 'barghest-pipeline-'));
writeFileSync(
  join(fixtures, 'spot-report.txt'),
  `PHILIPPINE NATIONAL POLICE
SAN MATEO CITY POLICE STATION
SPOT REPORT SR-SMPPO-2026-09-14-001

Date and time of incident: 14 September 2026, 0842H.
Place of incident: San Isidro National High School, Barangay Mabini, City of San Mateo.
Nature of incident: Shooting incident inside the junior high building.

Narrative: On or about 0842H, a male student identified as Joaquin Dela Peña, 15 years old, Grade 9 Section Rizal, allegedly fired a Glock 17 pistol, serial number BHPZ417, at students and a teacher in the north corridor. Responding personnel recovered the pistol at the scene, tagged as evidence E-001. The pistol is registered to the Philippine National Police under FEO reference GOV-PNP-2024-18827 and was issued to PSSg Rowena Dela Peña, 1st Provincial Mobile Force Company, under Property Acknowledgment Receipt PAR-PRO14-2024-03318. Victims were brought to San Mateo Provincial Hospital. Investigator on case: PMSg R. Tolentino.
`,
);
writeFileSync(
  join(fixtures, 'irf-blotter.txt'),
  `INCIDENT RECORD FORM IRF-2026-09-14-004, blotter entry 2026-1187

Complainant: Lorna Abalos, teacher, San Isidro National High School.
Suspect: DELA PEÑA, JOAQUIN, 15, Grade 9, resident of Barangay Mabini. Co-suspect: VILLARIN, MARCO, 14, Grade 9.

Narrative: At about 0842H of 14 September 2026 the suspect, J. Dela Peña, together with M. Villarin, entered the junior high building through the north emergency exit and fired a pistol at the students of Section Rizal. The pistol, a Glock 17 with serial BHPZ417, belongs to the suspect's aunt, PSSg Rowena Dela Peña of the San Mateo Provincial Police Office, who kept it in a locked plastic locker at the family residence in Barangay Mabini.

Charges drafted: murder, frustrated murder; CICL handling under RA 9344.
`,
);
writeFileSync(
  join(fixtures, 'messenger-thread.txt'),
  `Facebook Messenger thread, extract from Digital Forensic Examination Report DFER-R14-2026-0188 (device E-019, Samsung A15 of Joaquin Dela Peña).

M-0107 27 Jul 2026 21:12 VesperK to Joaquin DP: dito na tayo mag-usap. add me hollow.ix sa discord
M-0140 15 Aug 2026 22:03 Marco V. to Joaquin DP: nullveil is me
M-0188 11 Sep 2026 23:41 Joaquin DP to Marco V.: nakuha ko na. sa locker lang pala. bukas na
M-0190 13 Sep 2026 22:15 Joaquin DP to Marco V.: nasa bag ko na si glock
`,
);

async function importFile(name) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(join(fixtures, name))]), name);
  form.append('scenario', 'a');
  form.append('system', name.startsWith('spot') ? 'PNP Spot Report' : name.startsWith('irf') ? 'PNP CIRAS e-Blotter' : 'PNP-ACG Cyber Forensics');
  const r = await post('/barghest/import', form);
  if (r.status !== 200) throw new Error(`import ${name}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

async function waitExtracted(dc, documentId, maxMs = 6 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const v = await getObjectView(dc, 'Document', documentId);
    const status = String(v.properties.find((p) => p.apiName === 'status')?.value ?? '');
    if (status.startsWith('extracted') || status === 'extraction failed') return status;
    await sleep(2000);
  }
  return 'timeout';
}

cleanDb();
sample('start');
let engine = await startEngine();
try {
  const h = await health();
  check('engine is up with the model on', h?.ollama?.up === true && h.ollama.chat && h.ollama.embed, JSON.stringify(h?.ollama?.models));
  const dc = await connect(BASE);

  // Import, extraction in the background
  const docs = [];
  for (const name of ['spot-report.txt', 'irf-blotter.txt', 'messenger-thread.txt']) {
    const r = await importFile(name);
    docs.push({ name, ...r });
    check(`${name} imports and extraction starts`, r.extraction === 'started', `${r.passages} passages`);
  }
  sample('after import');
  const statuses = [];
  for (const d of docs) {
    const status = await waitExtracted(dc, d.documentId);
    statuses.push(`${d.name}: ${status}`);
    sample(`extracted ${d.name}`);
  }
  check('every document reaches extracted', statuses.every((s) => / extracted/.test(s)), statuses.join(' | '));

  const log = await get('/barghest/inference-log?after=0');
  const extractRows = log.filter((r) => r.purpose.startsWith('extract'));
  check('one inference-log row per model call, with tokens and latency', extractRows.length >= 3 && extractRows.every((r) => r.model === 'qwen3:4b-instruct' && r.latencyMs > 0 && r.promptTokens > 0), `${extractRows.length} rows, ${extractRows.filter((r) => r.ok).length} ok, avg ${Math.round(extractRows.reduce((n, r) => n + r.latencyMs, 0) / Math.max(extractRows.length, 1))} ms`);

  const people = await fetchRows(dc, { ...startExploration('Person', 200) });
  const mentions = people.rows.filter((r) => r.properties.passageId);
  const joaquins = mentions.filter((r) => /joaquin|j\. dela/i.test(r.title));
  check('people were extracted as mentions linked to their passage', mentions.length >= 3, `${mentions.length} mentions: ${mentions.map((r) => r.title).join(' | ')}`);
  check('the student appears under at least two spellings', joaquins.length >= 2, joaquins.map((r) => r.title).join(' | '));

  const rels = await fetchRows(dc, startExploration('Relationship', 200));
  check('relationships were extracted, every one with its passage', rels.rows.length >= 1 && rels.rows.every((r) => (r.properties.passageIds ?? []).length >= 1), `${rels.rows.length}: ${rels.rows.slice(0, 6).map((r) => r.title).join(' | ')}`);
  const firearms = await fetchRows(dc, withStep(startExploration('Firearm'), { filter: { property: 'serial', op: 'contains', value: 'BHPZ417' } }));
  check('the firearm serial BHPZ417 was extracted', firearms.rows.length >= 1, `${firearms.rows.length} firearm mention(s)`);

  // Resolution with the model deciding the unsure pairs
  sample('before resolve');
  const res = await post('/barghest/resolve?scenario=a');
  sample('after resolve');
  const ps = res.body.summary?.Person ?? {};
  check('resolve ran with the model on the 0.5 to 0.9 band', res.status === 200 && (ps.modelPairs ?? 0) + (ps.autoPairs ?? 0) >= 1 && (ps.reviewPairs ?? 0) === 0, JSON.stringify(ps));
  const canon = await fetchRows(dc, withStep(startExploration('Person', 200), { filter: { property: 'canonicalId', op: 'isEmpty' } }));
  const canonicalJoaquin = canon.rows.find((r) => /joaquin/i.test(r.title) && !r.properties.passageId);
  const jv = canonicalJoaquin ? await getObjectView(dc, 'Person', canonicalJoaquin.pk) : null;
  check('the student resolves to one canonical Person with his spellings as candidates', !!jv && jv.candidates.length >= 2, jv ? `${jv.title}: ${jv.candidates.length} candidates, aliases ${(jv.properties.find((p) => p.apiName === 'aliases')?.value ?? []).join(' | ')}` : 'no canonical Joaquin');
  check('resolutions name their method', !!jv && jv.resolutions.length >= 1 && jv.resolutions.every((r) => r.decidedBy && r.method), jv ? [...new Set(jv.resolutions.map((r) => r.decidedBy))].join(', ') : '');
  const rowena = canon.rows.filter((r) => /rowena/i.test(r.title) && !r.properties.passageId);
  check('Rowena is not merged into Joaquin', !jv || !jv.candidates.some((c) => /rowena/i.test(c.title)), rowena.map((r) => r.title).join(' | ') || 'rowena stands as her own mentions');
  const accounts = await fetchRows(dc, startExploration('DigitalAccount', 200));
  const owned = accounts.rows.filter((r) => r.properties.personId);
  check('the account-to-person pass ran over the extracted accounts', !!res.body.owners, `${accounts.rows.length} accounts, ${owned.length} owned: ${owned.map((r) => `${r.title} -> ${r.properties.personId}`).join(' | ') || 'none'}; ${JSON.stringify(res.body.owners)}`);

  // Embeddings and semantic search
  const emb = await post('/barghest/embed?scenario=a');
  sample('after embed');
  check('passages were embedded', emb.status === 200 && emb.body.embedded >= 3, JSON.stringify(emb.body));
  const s = await get(`/barghest/search?q=${encodeURIComponent('message saying he got the gun from the locker')}&scenario=a`);
  check('semantic search finds the "nakuha ko na" message', s.semantic >= 1 && s.passages.some((p) => p.text.includes('nakuha ko na')), `${s.passages.length} passages, ${s.semantic} semantic`);

  // Ask
  sample('before ask');
  const a = await post('/barghest/ask', { question: 'What connects Joaquin Dela Peña to the shooting at San Isidro National High School?', scenario: 'a' }, true);
  sample('after ask');
  check('the question is answered with citations', a.status === 200 && a.body.refused === false && a.body.citations.length >= 1, `${a.body.citations?.length} citations, ${a.body.latencyMs} ms`);
  console.log(`    answer: ${a.body.answer}`);
  for (const c of a.body.citations ?? []) console.log(`    [${c.passageId}] ${c.verbatim ? 'verbatim' : 'passage'}: ${c.quote.slice(0, 100)}`);
  const n = await post('/barghest/ask', { question: 'Who is the mayor of Davao City?', scenario: 'a' }, true);
  check('a question with no evidence is refused', n.body.refused === true && /no supporting records/.test(n.body.answer), n.body.answer);

  const logAll = await get('/barghest/inference-log?after=0');
  check('every model call is in the inference log', logAll.length >= extractRows.length + 3, `${logAll.length} rows: ${[...new Set(logAll.map((r) => r.purpose))].join(', ')}`);
} catch (e) {
  check('no exception', false, e?.message ?? String(e));
  console.error(e);
} finally {
  await stopEngine(engine);
  cleanDb();
  rmSync(fixtures, { recursive: true, force: true });
}

console.log('--- memory ---');
for (const m of mem) console.log('  ' + m);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:pipeline: FAIL (${failed.length} of ${results.length}) in ${since()}` : `proof:pipeline: OK (${results.length} checks) in ${since()}`);
process.exit(failed.length ? 1 : 0);
