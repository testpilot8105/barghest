// Step 7 proof (pnpm proof:rename): every name is a label on a fixed id. Rename an investigation, a file and a
// register, edit what an investigation looks for, move a file to another investigation, delete an investigation, and
// check the ids, the originals, the stored copies and the audit rows. Dev seed, throwaway database, model off.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, engineGet } from '../src/data/client.ts';
import { fetchRows, histogram } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';
import {
  createFolder,
  createInvestigation,
  deleteInvestigation,
  editInvestigation,
  extractAll,
  getDocumentView,
  getInvestigations,
  importFile,
  moveDocumentToInvestigation,
  renameDocument,
  renameInvestigation,
  renameRegister,
  setRegister,
} from '../src/data/intake.ts';
import { jsonSchemaOf, schemaFor } from './extract/schemas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8796;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-rename.sqlite';
const FILES = 'data/proof-rename-files';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: FILES };

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
const audit = (dc, objectId) => engineGet(dc, '/barghest/audit', { objectId });

async function main() {
  clean();
  await run('engine/dev-seed.mjs');
  let engine = await startEngine();
  try {
    const dc = await connect(BASE);

    // 0. The seed's document carries a shown name and register equal to its title and system
    const seed = await getDocumentView(dc, 'D-001');
    check('0 an imported file shows its title as name and its system as register', seed.document.name === seed.document.title && seed.document.register === seed.document.system, `${seed.document.name} / ${seed.document.register}`);

    // 1. An investigation, a folder and a file to work on
    const port = await createInvestigation(dc, { name: 'Port survey' });
    const docs = await createFolder(dc, { investigation: port.id, name: 'Docs' });
    const text = 'The MV Sierra Madre docked at Dalumat wharf on 3 March. Ana Reyes paid the port fee.';
    const wharf = await importFile(dc, { file: new File([text], 'wharf-log.txt', { type: 'text/plain' }), investigation: port.id, system: 'Port log', folderId: docs.id, extract: false });
    const v0 = await getDocumentView(dc, wharf.documentId);
    check('1 a new file shows name = title and register = system', v0.document.name === 'wharf-log.txt' && v0.document.register === 'Port log' && v0.document.title === 'wharf-log.txt' && v0.document.system === 'Port log', `${v0.document.name} / ${v0.document.register}`);

    // 2. Rename the investigation: label changes, id stays
    const renamed = await renameInvestigation(dc, port.id, 'Harbour survey');
    const list = await getInvestigations(dc);
    const row = (await audit(dc, `Investigation:${port.id}`)).find((r) => r.action === 'renameInvestigation');
    const emptyName = await refused(renameInvestigation(dc, port.id, '  '));
    check('2 renaming the investigation keeps its id; the list shows the new name; the audit row has old and new; empty is 400', renamed.id === port.id && renamed.name === 'Harbour survey' && list.investigations.find((i) => i.id === port.id)?.name === 'Harbour survey' && row?.params.from === 'Port survey' && row?.params.to === 'Harbour survey' && emptyName?.status === 400, `${port.id} -> ${renamed.name}`);

    // 3. Rename the file: the extension is kept, the title stays
    const r1 = await renameDocument(dc, wharf.documentId, 'Wharf log');
    const v1 = await getDocumentView(dc, wharf.documentId);
    const emptyFile = await refused(renameDocument(dc, wharf.documentId, ''));
    const rowFile = (await audit(dc, `Document:${wharf.documentId}`)).find((r) => r.action === 'renameDocument');
    check('3 renaming the file keeps the extension and the original title; the audit row has old and new; empty is 400', r1.name === 'Wharf log.txt' && v1.document.name === 'Wharf log.txt' && v1.document.title === 'wharf-log.txt' && v1.document.documentId === wharf.documentId && rowFile?.params.from === 'wharf-log.txt' && rowFile?.params.to === 'Wharf log.txt' && emptyFile?.status === 400, `${r1.name}, title ${r1.title}`);

    // 4. Change the file's register: the system stays; the register histogram follows
    const r2 = await setRegister(dc, wharf.documentId, 'Port authority');
    const v2 = await getDocumentView(dc, wharf.documentId);
    const h = await histogram(dc, withStep(startExploration('Document'), eq('scenario', port.id)), 'register');
    const rowReg = (await audit(dc, `Document:${wharf.documentId}`)).find((r) => r.action === 'setRegister');
    check('4 changing the register keeps the system; the register histogram follows; the audit row has old and new', r2.register === 'Port authority' && v2.document.register === 'Port authority' && v2.document.system === 'Port log' && h.buckets.some((b) => b.bucket === 'Port authority' && b.count === 1) && rowReg?.params.from === 'Port log' && rowReg?.params.to === 'Port authority', JSON.stringify(h.buckets));

    // 5. Rename a register across the investigation
    await importFile(dc, { file: new File(['Berth 3 log, 4 March.'], 'berth-3.txt', { type: 'text/plain' }), investigation: port.id, system: 'Port log', extract: false });
    await importFile(dc, { file: new File(['Berth 4 log, 5 March.'], 'berth-4.txt', { type: 'text/plain' }), investigation: port.id, system: 'Port log', extract: false });
    const rr = await renameRegister(dc, port.id, 'Port log', 'Harbour log');
    const h2 = await histogram(dc, withStep(startExploration('Document'), eq('scenario', port.id)), 'register');
    const regs = Object.fromEntries(h2.buckets.map((b) => [b.bucket, b.count]));
    const emptyTo = await refused(renameRegister(dc, port.id, 'Harbour log', ''));
    check('5 renaming a register changes every file carrying it and no other; empty target is 400', rr.documents === 2 && regs['Harbour log'] === 2 && regs['Port authority'] === 1 && emptyTo?.status === 400, JSON.stringify(regs));

    // 6. Edit what the investigation looks for; the schema follows; extract-all needs the model
    const edited = await editInvestigation(dc, port.id, ['vehicles', 'persons']);
    const keys = Object.keys(jsonSchemaOf(schemaFor(edited.blocks)).properties);
    const badBlock = await refused(editInvestigation(dc, port.id, ['persons', 'ships']));
    const noBlocks = await refused(editInvestigation(dc, port.id, []));
    const rowEdit = (await audit(dc, `Investigation:${port.id}`)).find((r) => r.action === 'editInvestigation');
    const all = await refused(extractAll(dc, port.id));
    check('6 editing the blocks stores them in canonical order and the next schema follows; bad blocks are 400; extract-all is 503 with the model off', same(edited.blocks, ['persons', 'vehicles']) && same(keys, ['persons', 'vehicles', 'relationships']) && badBlock?.status === 400 && noBlocks?.status === 400 && same(rowEdit?.params.to, ['persons', 'vehicles']) && all?.status === 503, `${edited.blocks.join(', ')}; extract-all ${all?.status}`);

    // 7. Move the file to another investigation, model off
    const procurement = await createFolder(dc, { investigation: 'solid-waste', name: 'Procurement' });
    const sameInv = await refused(moveDocumentToInvestigation(dc, { documentId: wharf.documentId, investigation: port.id, extract: false }));
    const moved = await moveDocumentToInvestigation(dc, { documentId: wharf.documentId, investigation: 'solid-waste', folderId: procurement.id, extract: false });
    const gone = await fetch(`${BASE}/barghest/document?documentId=${wharf.documentId}`);
    const there = await getDocumentView(dc, moved.documentId);
    const copy = join(root, there.document.path);
    check('7 moving the file to another investigation: new id, old one gone, folder, name and register kept, stored copy byte-equal, passages reported', sameInv?.status === 400 && moved.documentId !== wharf.documentId && gone.status === 404 && there.document.scenario === 'solid-waste' && there.folder?.id === procurement.id && there.document.name === 'Wharf log.txt' && there.document.register === 'Port authority' && there.document.title === 'wharf-log.txt' && existsSync(copy) && readFileSync(copy, 'utf8') === text && !existsSync(join(root, v2.document.path)) && moved.passages === 1 && moved.extraction === 'off', `${wharf.documentId} -> ${moved.documentId}, ${moved.passages} passage(s)`);

    // 8. Delete the investigation that still holds two files and a folder
    const del = await deleteInvestigation(dc, port.id);
    const after = await getInvestigations(dc);
    const foldersGone = await fetch(`${BASE}/barghest/folders?investigation=${port.id}`);
    const leftovers = [];
    for (const type of dc.catalog.order) {
      const rows = await fetchRows(dc, withStep(startExploration(type), eq('scenario', port.id)));
      if (rows.rows.length) leftovers.push(`${type}:${rows.rows.length}`);
    }
    const rowDel = (await audit(dc, `Investigation:${port.id}`)).find((r) => r.action === 'deleteInvestigation');
    check('8 deleting the investigation removes its two files and its folder, leaves nothing carrying its id, and writes the audit row', del.documents === 2 && del.folders === 1 && !after.investigations.some((i) => i.id === port.id) && foldersGone.status === 400 && leftovers.length === 0 && rowDel?.params.documents === 2, `${leftovers.join(', ') || 'nothing left'}`);

    // 9. A deleted investigation stays deleted across a restart, a demo one included
    await stopEngine(engine);
    engine = await startEngine();
    let dc2 = await connect(BASE);
    const afterRestart = await getInvestigations(dc2);
    const delDemo = await deleteInvestigation(dc2, 'solid-waste');
    await stopEngine(engine);
    engine = await startEngine();
    dc2 = await connect(BASE);
    const afterDemo = await getInvestigations(dc2);
    check('9 after a restart the deleted investigation stays gone; a deleted demo investigation is not recreated either', !afterRestart.investigations.some((i) => i.id === port.id) && afterRestart.investigations.length === 2 && delDemo.documents === 1 && same(afterDemo.investigations.map((i) => i.id), ['school-incident']) && !existsSync(copy), afterDemo.investigations.map((i) => i.id).join(', '));
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
console.log(failed.length ? `proof:rename: FAIL (${failed.length} of ${results.length})` : `proof:rename: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
