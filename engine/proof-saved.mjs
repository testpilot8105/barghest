// Saved items proof (pnpm proof:saved, engine-api.md 2.10): graphs, timelines, conversations and explorations as
// store records inside one investigation, with the folder counts, the refusals and the audit rows the contract
// promises, on a throwaway database with the model off. About five seconds. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, engineGet } from '../src/data/client.ts';
import { createFolder, createInvestigation, createSaved, deleteFolder, deleteInvestigation, deleteSaved, getFolders, getSaved, listSaved, moveFolder, updateSaved } from '../src/data/intake.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8798;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-saved.sqlite';
const FILES = 'data/proof-saved-files';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: FILES };
const INV = 'school-incident';
const OTHER = 'solid-waste';
const KINDS = ['graph', 'timeline', 'conversation', 'exploration'];

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
const entry = (list, id) => list.folders.find((f) => f.id === id);
const audit = (dc, id) => engineGet(dc, '/barghest/audit', { objectId: `Saved:${id}` });

async function main() {
  clean();
  let engine = await startEngine();
  try {
    const dc = await connect(BASE);
    const work = await createFolder(dc, { investigation: INV, name: 'Work' });
    const other = await createFolder(dc, { investigation: INV, name: 'Other' });
    const elsewhere = await createFolder(dc, { investigation: OTHER, name: 'Elsewhere' });

    // 1. One of each kind in a folder: slug ids, empty bodies, listed by kind and all together, opened with the body
    const made = {};
    for (const kind of KINDS) {
      made[kind] = await createSaved(dc, { investigation: INV, kind, name: `My ${kind}`, folderId: work.id });
      await sleep(5);
    }
    const byKind = await Promise.all(KINDS.map((k) => listSaved(dc, INV, k)));
    const all = await listSaved(dc, INV);
    const opened = await getSaved(dc, made.graph.id);
    check('1 one of each kind created in Work: slug ids, body {}, listed by kind (one each, no body) and all together (four), opened with its body',
      KINDS.every((k) => /^my-[a-z]+-[0-9a-f]{6}$/.test(made[k].id) && made[k].kind === k && made[k].folderId === work.id && JSON.stringify(made[k].body) === '{}')
        && byKind.every((l, i) => l.kind === KINDS[i] && l.items.length === 1 && l.items[0].id === made[KINDS[i]].id && l.items[0].body === undefined)
        && all.kind === null && all.items.length === 4 && opened.id === made.graph.id && JSON.stringify(opened.body) === '{}',
      `${made.graph.id}, ${all.items.length} in all`);

    // 2. Newest change first: the oldest item, saved again, comes first
    const before = (await listSaved(dc, INV)).items.map((s) => s.id);
    await sleep(5);
    const saved = await updateSaved(dc, made.graph.id, { body: { nodes: [{ type: 'Person', pk: 'P-001', x: 10, y: 20 }], focus: 'Person:P-001' } });
    const after = (await listSaved(dc, INV)).items.map((s) => s.id);
    const reopened = await getSaved(dc, made.graph.id);
    check('2 saving a body moves updatedAt, puts the item first, and getSaved returns the body',
      before[0] !== made.graph.id && after[0] === made.graph.id && saved.updatedAt > made.graph.updatedAt && reopened.body.nodes?.[0]?.pk === 'P-001' && reopened.body.focus === 'Person:P-001',
      `first before: ${before[0]}, after: ${after[0]}`);

    // 3. Rename keeps the id; move to another folder, then to the top level
    const renamed = await updateSaved(dc, made.timeline.id, { name: 'September' });
    const moved = await updateSaved(dc, made.conversation.id, { folderId: other.id });
    const toTop = await updateSaved(dc, made.exploration.id, { folderId: '' });
    const unchanged = await updateSaved(dc, made.timeline.id, { name: 'September' });
    check('3 rename keeps the id; a move to another folder and to the top level land; the same name again changes nothing',
      renamed.id === made.timeline.id && renamed.name === 'September' && moved.folderId === other.id && toTop.folderId === '' && unchanged.updatedAt === renamed.updatedAt,
      `${renamed.id} -> "${renamed.name}"; ${moved.folderId}; "${toTop.folderId}"`);

    // 4. getFolders counts them, next to the files
    const counts = await getFolders(dc, INV);
    check('4 getFolders counts saved items per folder and at the top level',
      entry(counts, work.id)?.saved === 2 && entry(counts, other.id)?.saved === 1 && counts.topLevelSaved === 1 && entry(counts, work.id)?.files === 0,
      `Work ${entry(counts, work.id)?.saved}, Other ${entry(counts, other.id)?.saved}, top ${counts.topLevelSaved}`);

    // 5. A folder holding one is not empty
    const delFull = await refused(deleteFolder(dc, other.id));
    check('5 deleting a folder that holds a saved item is 409 with the screen\'s words', delFull?.status === 409 && /inside first/.test(delFull?.message ?? ''), `${delFull?.status} "${delFull?.message}"`);

    // 6. Moving a folder takes its saved items with it
    await moveFolder(dc, other.id, work.id);
    const nested = await getFolders(dc, INV);
    const stillThere = await getSaved(dc, made.conversation.id);
    check('6 a folder moved under another keeps its saved item', entry(nested, other.id)?.parentId === work.id && entry(nested, other.id)?.saved === 1 && stillThere.folderId === other.id, `Other under ${entry(nested, other.id)?.parentId}`);

    // 7. Refusals
    const badKind = await refused(createSaved(dc, { investigation: INV, kind: 'note', name: 'x' }));
    const noName = await refused(createSaved(dc, { investigation: INV, kind: 'graph', name: '  ' }));
    const crossFolder = await refused(createSaved(dc, { investigation: INV, kind: 'graph', name: 'x', folderId: elsewhere.id }));
    const crossMove = await refused(updateSaved(dc, made.graph.id, { folderId: elsewhere.id }));
    const badBody = await refused(updateSaved(dc, made.graph.id, { body: [1, 2] }));
    const emptyRename = await refused(updateSaved(dc, made.graph.id, { name: '' }));
    const unknownGet = await refused(getSaved(dc, 'nope'));
    const unknownUpdate = await refused(updateSaved(dc, 'nope', { name: 'x' }));
    const unknownDelete = await refused(deleteSaved(dc, 'nope'));
    const badList = await fetch(`${BASE}/barghest/saved?investigation=${INV}&kind=note`);
    check('7 an unknown kind, an empty name, another investigation\'s folder (create and move), a body that is not an object are 400; an unknown id is 404 on open, update and delete',
      [badKind, noName, crossFolder, crossMove, badBody, emptyRename].every((e) => e?.status === 400) && [unknownGet, unknownUpdate, unknownDelete].every((e) => e?.status === 404) && badList.status === 400,
      `${[badKind, noName, crossFolder, crossMove, badBody, emptyRename].map((e) => e?.status).join(' ')} / ${[unknownGet, unknownUpdate, unknownDelete].map((e) => e?.status).join(' ')} / list ${badList.status}`);

    // 8. Every change wrote an audit row, by the analyst, with the old and the new value where there is one
    const aGraph = await audit(dc, made.graph.id);
    const aTimeline = await audit(dc, made.timeline.id);
    const aConversation = await audit(dc, made.conversation.id);
    const bodyRow = aGraph.find((r) => r.action === 'updateSavedBody');
    const renameRow = aTimeline.find((r) => r.action === 'renameSaved');
    const moveRow = aConversation.find((r) => r.action === 'moveSaved');
    check('8 audit rows: createSaved on each, renameSaved and moveSaved with old and new, updateSavedBody without the body, all by the analyst',
      [aGraph, aTimeline, aConversation].every((rows) => rows.some((r) => r.action === 'createSaved') && rows.every((r) => r.actor === 'analyst'))
        && bodyRow && bodyRow.params.body === undefined && renameRow?.params.from === 'My timeline' && renameRow?.params.to === 'September' && moveRow?.params.from === work.id && moveRow?.params.to === other.id
        && aTimeline.filter((r) => r.action === 'renameSaved').length === 1,
      `${aGraph.map((r) => r.action).join(',')} | ${aTimeline.map((r) => r.action).join(',')}`);

    // 9. Items survive a restart
    await stopEngine(engine);
    engine = await startEngine();
    const dc2 = await connect(BASE);
    const afterRestart = await listSaved(dc2, INV);
    const bodyAfter = await getSaved(dc2, made.graph.id);
    check('9 after a restart all four are listed and the body is intact', afterRestart.items.length === 4 && bodyAfter.body.focus === 'Person:P-001', `${afterRestart.items.length} items`);

    // 10. Delete each: gone from the list, 404 on open, an audit row
    for (const kind of KINDS) await deleteSaved(dc2, made[kind].id);
    const none = await listSaved(dc2, INV);
    const gone = await refused(getSaved(dc2, made.graph.id));
    const aDeleted = await audit(dc2, made.graph.id);
    const emptied = await getFolders(dc2, INV);
    check('10 deleting each: the list is empty, getSaved is 404, deleteSaved audited, the folders count zero', none.items.length === 0 && gone?.status === 404 && aDeleted.some((r) => r.action === 'deleteSaved') && entry(emptied, work.id)?.saved === 0 && emptied.topLevelSaved === 0, `${none.items.length} left, ${gone?.status}`);

    // 11. Deleting an investigation removes its saved items and counts them
    const temp = await createInvestigation(dc2, { name: 'Proof saved' });
    await createSaved(dc2, { investigation: temp.id, kind: 'graph', name: 'Temp graph' });
    await createSaved(dc2, { investigation: temp.id, kind: 'conversation', name: 'Temp chat' });
    const removed = await deleteInvestigation(dc2, temp.id);
    const listGone = await fetch(`${BASE}/barghest/saved?investigation=${temp.id}`);
    check('11 deleting an investigation removes its saved items and the reply counts them', removed.deleted && removed.saved === 2 && listGone.status === 400, `saved=${removed.saved}, list ${listGone.status}`);

    // The other investigation kept its folder; tidy the proof folders
    await deleteFolder(dc2, elsewhere.id);
    await deleteFolder(dc2, other.id);
    await deleteFolder(dc2, work.id);
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
console.log(failed.length ? `proof:saved: FAIL (${failed.length} of ${results.length})` : `proof:saved: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
