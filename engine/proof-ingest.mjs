// Ingest proof (node engine/proof-ingest.mjs): four small fixture files (a real PDF rendered by Chromium, a CSV, a
// TXT, a JSON export) go through POST /barghest/import against the engine on a throwaway database. Each becomes a
// Document with Passages (and SourceRecords for the tables), readable through the Object Explorer data layer and
// listed in the audit log. No model is involved. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '../src/data/client.ts';
import { countRows, fetchRows, getObjectView } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8790;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-ingest.sqlite';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: 'data/proof-ingest-files' };

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
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
const cleanDb = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
  rmSync(join(root, 'data/proof-ingest-files'), { recursive: true, force: true });
};

// ---- Fixtures: shaped like the registers the real packs imitate, every identity invented.
const fixtures = mkdtempSync(join(tmpdir(), 'barghest-ingest-'));
const SPOT_REPORT = `MAHARLIKA POLICE DEPARTMENT
SAN MATEO STATION
FIELD REPORT FR-SMS-2026-09-14-001

Date and time of incident: 14 September 2026, 0842H.
Place of incident: Maharlika National High School, Barangay Mabini, City of San Mateo.
Nature of incident: Shooting incident inside the junior high building.

Narrative: On or about 0842H, a male student identified as Joaquin Dela Pena, 15 years old, Grade 9, allegedly fired a Glock 17 pistol, serial number BHPZ417, at students and a teacher in the north corridor. Responding personnel recovered the pistol at the scene, tagged as evidence E-001, together with a .38 caliber revolver, serial RIA38-1177093, tagged E-002. Victims were brought to San Mateo Provincial Hospital. Investigator on case: Sgt. R. Tolentino.`;
writeFileSync(join(fixtures, 'mpd-blotter.txt'), SPOT_REPORT.replace('FIELD REPORT', 'INCIDENT RECORD IR-2026-09-14-004, blotter entry 2026-1187'));
writeFileSync(
  join(fixtures, 'school-records.csv'),
  'Student ID,Learner Name,Grade,Section,Adviser,Guardian,Date\n' +
    '109876543210,"DELA PENA, JOAQUIN",9,Rizal,"ABALOS, LORNA","DELA PENA, NESTOR",2026-06-02\n' +
    '109876551234,"VILLARIN, MARCO",9,Bonifacio,"CRUZ, ANA","VILLARIN, RAMON",2026-06-02\n' +
    '109876544001,"RAMOS, ALTHEA",9,Rizal,"ABALOS, LORNA","RAMOS, ELENA",2026-06-02\n',
);
writeFileSync(
  join(fixtures, 'discord-export.json'),
  JSON.stringify({ guild: { id: '1183322990011223344', name: 'VOIDHOUSE' }, messages: [
    { id: '1', channel: '#gates', author: 'Vesper_Krael', timestamp: '2026-08-15T13:02:00Z', content: 'read this and tell me you understand' },
    { id: '2', channel: '#void-logs', author: 'Vesper_Krael', timestamp: '2026-09-14T01:22:00Z', content: 'wipe everything' },
  ] }),
);

async function makePdf() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage();
  await page.setContent(`<html><body style="font-family: Helvetica; font-size: 12px"><pre style="white-space: pre-wrap; font-family: Helvetica">${SPOT_REPORT}</pre></body></html>`);
  const path = join(fixtures, 'field-report.pdf');
  await page.pdf({ path, format: 'A4' });
  await browser.close();
  return path;
}

async function importFile(path, investigation = 'school-incident', system = 'proof') {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(path)]), path.split('/').pop());
  form.append('investigation', investigation);
  form.append('system', system);
  const r = await fetch(`${BASE}/barghest/import`, { method: 'POST', body: form });
  const body = await r.json();
  if (!r.ok) throw new Error(`import ${path}: ${r.status} ${JSON.stringify(body)}`);
  return body;
}

cleanDb();
let engine = await startEngine();
try {
  await makePdf();
  const dc = await connect(BASE);

  const pdf = await importFile(join(fixtures, 'field-report.pdf'));
  check('field-report.pdf imports with text from pdfjs', pdf.passages >= 1 && pdf.chars > 400 && pdf.pages === 1, `${pdf.passages} passages, ${pdf.chars} chars`);
  const pdfView = await getObjectView(dc, 'Document', pdf.documentId);
  const pdfPassages = pdfView.links.find((l) => l.link === 'passages');
  check('the PDF Document links to its passages', (pdfPassages?.count ?? 0) === pdf.passages, `${pdfPassages?.count} passages`);
  const serial = await fetchRows(dc, withStep(startExploration('Passage'), { filter: { property: 'text', op: 'contains', value: 'BHPZ417' } }));
  check('the serial number is findable in a PDF passage', serial.rows.length >= 1, `${serial.rows.length} passages mention BHPZ417`);

  const txt = await importFile(join(fixtures, 'mpd-blotter.txt'));
  check('mpd-blotter.txt imports', txt.passages >= 1 && txt.records === 0, `${txt.passages} passages`);

  const csv = await importFile(join(fixtures, 'school-records.csv'));
  check('school-records.csv imports as 3 source records', csv.records === 3 && csv.passages >= 1, `${csv.records} records, ${csv.passages} passages`);
  const rec = await fetchRows(dc, withStep(startExploration('SourceRecord'), { filter: { property: 'rawJson', op: 'contains', value: '109876543210' } }));
  check('a CSV row is a SourceRecord with its raw JSON and observedAt', rec.rows.length === 1 && String(rec.rows[0].properties.observedAt ?? '').startsWith('2026-06-02'), rec.rows[0]?.title);

  const json = await importFile(join(fixtures, 'discord-export.json'));
  check('discord-export.json imports as 2 source records', json.records === 2, `${json.records} records`);

  // A long table with no full stops: every row must survive the passage split (reported by the case-files session).
  const lrns = Array.from({ length: 40 }, (_, i) => String(109876500000 + i));
  writeFileSync(
    join(fixtures, 'big-roster.csv'),
    'Student ID,Learner Name,Grade,Section,Adviser,Guardian,Remarks\n' + lrns.map((lrn, i) => `${lrn},"LEARNER ${i} WITH A LONG FAMILY NAME",9,Rizal,"ABALOS, LORNA","GUARDIAN ${i}",enrolled and attending regularly this school year`).join('\n') + '\n',
  );
  const big = await importFile(join(fixtures, 'big-roster.csv'));
  const lost = [];
  for (const lrn of lrns) {
    const hit = await fetchRows(dc, withStep(startExploration('Passage', 10), { filter: { property: 'text', op: 'contains', value: lrn } }));
    if (hit.rows.length === 0) lost.push(lrn);
  }
  check('a 40-row table with no full stops keeps every row in its passages', big.passages >= 2 && lost.length === 0, `${big.passages} passages, ${lost.length} rows lost`);

  const docs = await countRows(dc, startExploration('Document'));
  check('five Documents in the store', docs === 5, `${docs}`);

  const twice = await importFile(join(fixtures, 'school-records.csv'));
  const docsAfter = await countRows(dc, startExploration('Document'));
  check('importing the same file again does not duplicate it', twice.documentId === csv.documentId && docsAfter === 5, `${docsAfter} documents`);

  const audit = await fetch(`${BASE}/barghest/audit?objectId=Document:${csv.documentId}`).then((r) => r.json());
  check('each import is in the audit log', audit.length === 2 && audit.every((a) => a.action === 'importDocument'), `${audit.length} entries`);

  const log = await fetch(`${BASE}/barghest/inference-log?after=0`).then((r) => r.json());
  check('inference log is empty: no model ran', Array.isArray(log) && log.length === 0, `${log.length} rows`);

  const bad = await fetch(`${BASE}/barghest/import`, { method: 'POST', body: (() => { const f = new FormData(); f.append('file', new Blob(['x']), 'x.exe'); f.append('investigation', 'school-incident'); return f; })() });
  check('an unsupported file type is refused with 400', bad.status === 400);
} catch (e) {
  check('no exception', false, e?.message ?? String(e));
  console.error(e);
} finally {
  await stopEngine(engine);
  cleanDb();
  rmSync(fixtures, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:ingest: FAIL (${failed.length} of ${results.length})` : `proof:ingest: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
