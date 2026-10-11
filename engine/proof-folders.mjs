// Step 6 proof (pnpm proof:folders): folders as store records inside one investigation, with the counts, the
// refusals and the audit rows the contract promises, on the dev seed on a throwaway database with the model off.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, engineGet } from '../src/data/client.ts';
import { fetchRows } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';
import { createFolder, deleteFolder, getDocumentView, getFolders, importFile, moveDocument, moveFolder, renameFolder } from '../src/data/intake.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8795;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-folders.sqlite';
const FILES = 'data/proof-folders-files';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: FILES };
const INV = 'school-incident';
const OTHER = 'solid-waste';
void readFileSync;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const refused = (promise) => promise.then(() => null, (e) => e);
const eq = (property, value) => ({ filter: { property, op: 'eq', value } });
const isEmpty = (property) => ({ filter: { property, op: 'isEmpty' } });

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
const entry = (list, id) => list.folders.find((f) => f.id === id);

async function main() {
  clean();
  await run('engine/dev-seed.mjs');
  let engine = await startEngine();
  try {
    const dc = await connect(BASE);

    // 1. Nothing yet: the seed's document sits at the top level
    const empty = await getFolders(dc, INV);
    check('1 with no folders the list is empty and the seed document counts at the top level', empty.folders.length === 0 && empty.topLevelFiles === 1, `${empty.folders.length} folders, ${empty.topLevelFiles} top-level files`);

    // 2. Create a folder and a subfolder
    const police = await createFolder(dc, { investigation: INV, name: 'Police' });
    const older = await createFolder(dc, { investigation: INV, name: 'Older reports', parentId: police.id });
    const two = await getFolders(dc, INV);
    check('2 a folder and a subfolder: slug ids, the parent counts one subfolder, both hold no files', /^police-[0-9a-f]{6}$/.test(police.id) && older.parentId === police.id && entry(two, police.id)?.subfolders === 1 && entry(two, police.id)?.files === 0 && entry(two, older.id)?.files === 0, `${police.id}, ${older.id}`);

    // 3. Import into a folder: the count, the file view's folder, and the Document filter
    const imported = await importFile(dc, { file: new File(['Blotter entry 44: Rowena Dela Peña reported the locker.'], 'blotter-44.txt', { type: 'text/plain' }), investigation: INV, system: 'MPD Blotter', folderId: police.id, extract: false });
    const afterImport = await getFolders(dc, INV);
    const view = await getDocumentView(dc, imported.documentId);
    const inPolice = await fetchRows(dc, withStep(startExploration('Document'), eq('folderId', police.id)));
    check('3 a file imported into Police counts there, the file view names the folder, the Document filter finds it', entry(afterImport, police.id)?.files === 1 && afterImport.topLevelFiles === 1 && view.folder?.id === police.id && view.folder?.name === 'Police' && inPolice.rows.length === 1 && inPolice.rows[0].pk === imported.documentId, `${entry(afterImport, police.id)?.files} in Police; view folder ${view.folder?.name}`);

    // 4. Move the file into the subfolder
    await moveDocument(dc, imported.documentId, older.id);
    const afterMove = await getFolders(dc, INV);
    check('4 moving the file to the subfolder shifts the counts', entry(afterMove, police.id)?.files === 0 && entry(afterMove, older.id)?.files === 1, `Police ${entry(afterMove, police.id)?.files}, Older reports ${entry(afterMove, older.id)?.files}`);

    // 5. Rename keeps the id
    const archive = await renameFolder(dc, older.id, 'Archive');
    const viewAfterRename = await getDocumentView(dc, imported.documentId);
    check('5 renaming the subfolder keeps its id; the file view shows the new name', archive.id === older.id && archive.name === 'Archive' && viewAfterRename.folder?.name === 'Archive', `${archive.id} -> ${archive.name}`);

    // 6. Refusals: delete a non-empty folder, move a folder into its child or itself
    const delFull = await refused(deleteFolder(dc, police.id));
    const intoChild = await refused(moveFolder(dc, police.id, archive.id));
    const intoSelf = await refused(moveFolder(dc, police.id, police.id));
    check('6 deleting a non-empty folder is 409 with the screen\'s words; moving a folder into its child or itself is 400', delFull?.status === 409 && /inside first/.test(delFull?.message ?? '') && intoChild?.status === 400 && intoSelf?.status === 400, `${delFull?.status} "${delFull?.message}"; ${intoChild?.status}; ${intoSelf?.status}`);

    // 7. Refusals: a duplicate sibling, and anything crossing investigations
    const dup = await refused(createFolder(dc, { investigation: INV, name: 'police' }));
    const procurement = await createFolder(dc, { investigation: OTHER, name: 'Procurement' });
    const crossMove = await refused(moveDocument(dc, imported.documentId, procurement.id));
    const crossImport = await refused(importFile(dc, { file: new File(['x'], 'x.txt', { type: 'text/plain' }), investigation: INV, folderId: procurement.id, extract: false }));
    const crossFolder = await refused(moveFolder(dc, archive.id, procurement.id));
    check('7 a duplicate sibling name is 400; moving a file, importing a file or moving a folder across investigations is 400', dup?.status === 400 && crossMove?.status === 400 && crossImport?.status === 400 && crossFolder?.status === 400, `${dup?.status} ${crossMove?.status} ${crossImport?.status} ${crossFolder?.status}`);

    // 8. Back to the top level: the file, then the folder; the top-level filter sees both files
    await moveDocument(dc, imported.documentId, '');
    const movedUp = await moveFolder(dc, archive.id, '');
    const afterUp = await getFolders(dc, INV);
    const top = await fetchRows(dc, withStep(startExploration('Document'), isEmpty('folderId')));
    const viewTop = await getDocumentView(dc, imported.documentId);
    check('8 the file and then the folder move to the top level; the isEmpty filter sees both top-level files', movedUp.parentId === '' && entry(afterUp, police.id)?.subfolders === 0 && entry(afterUp, archive.id)?.files === 0 && afterUp.topLevelFiles === 2 && top.rows.length === 2 && viewTop.folder === null, `${afterUp.topLevelFiles} top-level files`);

    // 9. Empty folders delete
    const d1 = await deleteFolder(dc, police.id);
    const d2 = await deleteFolder(dc, archive.id);
    const none = await getFolders(dc, INV);
    const other = await getFolders(dc, OTHER);
    check('9 empty folders delete; the other investigation keeps its own', d1.deleted && d2.deleted && none.folders.length === 0 && other.folders.length === 1 && other.folders[0].id === procurement.id, `${none.folders.length} left here, ${other.folders.length} there`);

    // 10. Every step wrote an audit row with the old and the new value
    const auditPolice = await engineGet(dc, '/barghest/audit', { objectId: `Folder:${police.id}` });
    const auditArchive = await engineGet(dc, '/barghest/audit', { objectId: `Folder:${archive.id}` });
    const auditDoc = await engineGet(dc, '/barghest/audit', { objectId: `Document:${imported.documentId}` });
    const actions = (rows) => rows.map((r) => r.action);
    const rename = auditArchive.find((r) => r.action === 'renameFolder');
    const moveF = auditArchive.find((r) => r.action === 'moveFolder');
    const moves = auditDoc.filter((r) => r.action === 'moveDocument');
    check('10 audit rows: create and delete on both folders, the rename and the move with old and new values, two file moves', actions(auditPolice).includes('createFolder') && actions(auditPolice).includes('deleteFolder') && rename?.params.from === 'Older reports' && rename?.params.to === 'Archive' && moveF?.params.from === police.id && moveF?.params.to === '' && moves.length === 2 && moves[0].params.to === older.id && moves[1].params.to === '' && moves.every((r) => r.actor === 'analyst'), `${auditPolice.length} + ${auditArchive.length} folder rows, ${moves.length} file moves`);

    // 11. Unknown ids
    const unknownInv = await fetch(`${BASE}/barghest/folders?investigation=nope`);
    const unknownFolder = await refused(renameFolder(dc, 'nope', 'x'));
    check('11 an unknown investigation or folder is 400', unknownInv.status === 400 && unknownFolder?.status === 400, `${unknownInv.status} ${unknownFolder?.status}`);

    // 12. Folders and the file's place survive a restart
    const keep = await createFolder(dc, { investigation: INV, name: 'Keep' });
    await moveDocument(dc, imported.documentId, keep.id);
    await stopEngine(engine);
    engine = await startEngine();
    const dc2 = await connect(BASE);
    const after = await getFolders(dc2, INV);
    const viewAfter = await getDocumentView(dc2, imported.documentId);
    check('12 after a restart the folder is there with its file, and the file view still names it', entry(after, keep.id)?.files === 1 && viewAfter.folder?.id === keep.id, `${entry(after, keep.id)?.files} file in ${viewAfter.folder?.name}`);
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
console.log(failed.length ? `proof:folders: FAIL (${failed.length} of ${results.length})` : `proof:folders: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
