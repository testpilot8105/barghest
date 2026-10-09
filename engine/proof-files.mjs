// Step 3 proof (pnpm proof:files): the stored original is kept and served, and a file with no text is said so, on a
// throwaway database and a throwaway files folder with the model off. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '../src/data/client.ts';
import { fetchRows } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';
import { extractAgain, fileUrl, importFile } from '../src/data/intake.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8791;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-files.sqlite';
const FILES = 'data/proof-files';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: FILES };
const INVESTIGATION = 'school-incident';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const refused = (promise) => promise.then(() => null, (e) => e);

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
const clean = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
  rmSync(join(root, FILES), { recursive: true, force: true });
};
const realFiles = () => (existsSync(join(root, 'data', 'files')) ? readdirSync(join(root, 'data', 'files')).sort().join(',') : '(absent)');

/** A valid one-page PDF with no text at all: what a scan looks like to the parser. */
function emptyPdf() {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>'];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function main() {
  clean();
  const realBefore = realFiles();
  let engine = await startEngine();
  try {
    const dc = await connect(BASE);

    // 1. A real PDF from the pack, model off
    const source = readFileSync(join(root, 'data', INVESTIGATION, 'sources', 'spot-report.pdf'));
    const pdf = new File([source], 'spot-report.pdf', { type: 'application/pdf' });
    const imported = await importFile(dc, { file: pdf, investigation: INVESTIGATION, system: 'PNP Spot Report', extract: false });
    check('1 a PDF with text imports as "imported", with passages and a path in the files folder', imported.status === 'imported' && imported.chars > 0 && imported.passages >= 1 && imported.path === `${FILES}/${imported.documentId}.pdf` && imported.extraction === 'off', `${imported.documentId}: ${imported.passages} passages, ${imported.chars} chars, ${imported.path}`);

    // 2. The stored copy is on disk, byte-equal
    const stored = join(root, imported.path);
    check('2 the stored copy exists and is byte-equal to the source', existsSync(stored) && readFileSync(stored).equals(source), `${source.length} bytes`);

    // 3. GET file serves it inline as a PDF, byte-equal
    const res = await fetch(fileUrl(dc, imported.documentId));
    const body = Buffer.from(await res.arrayBuffer());
    check('3 GET file streams the original as application/pdf, inline, byte-equal', res.status === 200 && res.headers.get('content-type') === 'application/pdf' && (res.headers.get('content-disposition') ?? '').startsWith('inline') && body.equals(source), `${res.status} ${res.headers.get('content-type')}; ${res.headers.get('content-disposition')}; ${body.length} bytes`);

    // 4. The Document carries the path and the status
    const rows = await fetchRows(dc, withStep(startExploration('Document'), { filter: { property: 'documentId', op: 'eq', value: imported.documentId } }));
    check('4 the Document object carries the stored path and the status', rows.rows.length === 1 && rows.rows[0].properties.path === imported.path && rows.rows[0].properties.status === 'imported', String(rows.rows[0]?.properties.path));

    // 5. The same file again: the same Document, no duplicate
    const again = await importFile(dc, { file: pdf, investigation: INVESTIGATION, system: 'PNP Spot Report', extract: false });
    const count = await fetchRows(dc, startExploration('Document'));
    check('5 the same file again is the same Document, no duplicate, the copy still there', again.documentId === imported.documentId && count.rows.length === 1 && existsSync(stored), `${count.rows.length} document(s)`);

    // 6. A PDF with no text: "no text", nothing read, still served
    const blank = emptyPdf();
    const noText = await importFile(dc, { file: new File([blank], 'scan.pdf', { type: 'application/pdf' }), investigation: INVESTIGATION, extract: false });
    const served = await fetch(fileUrl(dc, noText.documentId));
    const servedBody = Buffer.from(await served.arrayBuffer());
    check('6 a PDF with no text imports as "no text" with no passages, extraction "no text", and is still served byte-equal', noText.status === 'no text' && noText.extraction === 'no text' && noText.passages === 0 && noText.chars === 0 && noText.pages === 1 && served.status === 200 && servedBody.equals(blank), JSON.stringify({ status: noText.status, extraction: noText.extraction, passages: noText.passages, pages: noText.pages, served: served.status }));

    // 7. extract refuses it; an import that would read it says "no text" instead
    const refusedExtract = await refused(extractAgain(dc, noText.documentId));
    const wouldRead = await importFile(dc, { file: new File([blank], 'scan.pdf', { type: 'application/pdf' }), investigation: INVESTIGATION });
    check('7 extract on a no-text file is refused with 400; an import that would read it answers "no text"', refusedExtract?.status === 400 && /no text/.test(refusedExtract?.message ?? '') && wouldRead.extraction === 'no text', `${refusedExtract?.status} ${refusedExtract?.message}; ${wouldRead.extraction}`);

    // 8. An empty text file is "no text" too
    const emptyTxt = await importFile(dc, { file: new File(['   \n'], 'empty.txt', { type: 'text/plain' }), investigation: INVESTIGATION, extract: false });
    check('8 an empty text file is "no text" too', emptyTxt.status === 'no text' && emptyTxt.passages === 0, `${emptyTxt.status}, ${emptyTxt.passages} passages`);

    // 9. Unknown and missing ids
    const unknown = await fetch(`${BASE}/barghest/file?documentId=D-nope`);
    const missing = await fetch(`${BASE}/barghest/file`);
    check('9 GET file is 404 for an unknown document and 400 without an id', unknown.status === 404 && missing.status === 400, `${unknown.status} ${missing.status}`);

    // 10. A text file is served as text with its charset
    const note = 'Mabansag Hauling Services, TIN 123.';
    const txt = await importFile(dc, { file: new File([note], 'note.txt', { type: 'text/plain' }), investigation: INVESTIGATION, extract: false });
    const txtRes = await fetch(fileUrl(dc, txt.documentId));
    check('10 a TXT is served as text/plain in utf-8, byte-equal', txtRes.status === 200 && txtRes.headers.get('content-type') === 'text/plain; charset=utf-8' && (await txtRes.text()) === note, String(txtRes.headers.get('content-type')));

    // 11. Restart: the copy and the path survive
    await stopEngine(engine);
    engine = await startEngine();
    const dc2 = await connect(BASE);
    const res2 = await fetch(fileUrl(dc2, imported.documentId));
    check('11 after a restart the original is still served byte-equal', res2.status === 200 && Buffer.from(await res2.arrayBuffer()).equals(source), `${res2.status}`);

    // 12. The real files folder was never touched
    check('12 nothing landed in the real data/files folder (the proof used its own)', realFiles() === realBefore, realBefore);
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
console.log(failed.length ? `proof:files: FAIL (${failed.length} of ${results.length})` : `proof:files: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
