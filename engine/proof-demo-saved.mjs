// Demo saved items proof (pnpm proof:demo-saved, engine-api.md 2.10): the two packs' saved.json resolved by name on
// a throwaway database with the model off. Objects are planted straight into the store the way the dev seed does,
// the engine starts on them, and the seed runs twice: once to create, once to prove it changes nothing; then the
// canonical object changes under it (a re-resolution) and the items follow. A name that is not there leaves its item
// out and says so. About five seconds. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, engineGet } from '../src/data/client.ts';
import { getSaved, listSaved } from '../src/data/intake.ts';
import { openStore } from './store.mjs';
import { toServerObject } from './faux.mjs';
import { plain, readPackSaved, resolveTarget, seedSaved } from './demo-saved.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8799;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-demo-saved.sqlite';
const FILES = 'data/proof-demo-saved-files';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: FILES };
const meta = JSON.parse(readFileSync(join(root, 'ontology', 'ontology.json'), 'utf8'));
const SCHOOL = 'school-incident';
const WASTE = 'solid-waste';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quiet = () => {};

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

/** Objects written straight into the store, the engine down, as the dev seed does. */
function plant(rows, removals = []) {
  const store = openStore(resolve(root, DB));
  for (const [type, pk] of removals) store.remove(type, pk);
  store.upsertMany(rows.map(([type, props]) => toServerObject(meta, type, props)));
  store.close();
}

const school = (type, props) => [type, { scenario: SCHOOL, ...props }];
const waste = (type, props) => [type, { scenario: WASTE, ...props }];
const audit = (dc, id) => engineGet(dc, '/barghest/audit', { objectId: `Saved:${id}` });
const byName = (list, name) => list.items.find((s) => s.name === name);

async function main() {
  clean();
  // Round one: the school cast after resolution. One canonical person with two mentions pointing at it, one lone
  // mention that shares a surname, the incident, the server, the moderator's account and a look-alike account.
  plant([
    school('Person', { personId: 'P-c1', fullName: 'Joaquin Dela Peña', aliases: ['DELA PENA, JOAQUIN', 'J. M. Dela Peña'], role: 'subject' }),
    school('Person', { personId: 'P-m1', fullName: 'DELA PENA, JOAQUIN', aliases: [], passageId: 'PS-1', canonicalId: 'P-c1' }),
    school('Person', { personId: 'P-m2', fullName: 'Joaquin Dela Peña', aliases: [], passageId: 'PS-2', canonicalId: 'P-c1' }),
    school('Person', { personId: 'P-m3', fullName: 'Nestor Dela Peña', aliases: [], passageId: 'PS-3' }),
    school('Incident', { incidentId: 'I-1', label: 'Shooting at Maharlika National High School', passageId: 'PS-4' }),
    school('OnlineGroup', { groupId: 'G-1', name: 'VOIDHOUSE', passageId: 'PS-5' }),
    school('DigitalAccount', { accountId: 'A-1', handle: 'Vesper_Krael', platform: 'Discord', passageId: 'PS-5' }),
    school('DigitalAccount', { accountId: 'A-2', handle: 'VesperK', platform: 'Roblox', passageId: 'PS-6' }),
  ]);
  let engine = await startEngine();
  try {
    const dc = await connect(BASE);

    // 1. Resolution by name picks the node the graph shows: the canonical, never a mention pointing at it.
    const canonical = await resolveTarget(dc, SCHOOL, { type: 'Person', name: 'Joaquin Dela Peña' });
    check('exact name resolves to the canonical object, not its mention', canonical.id === 'Person:P-c1', JSON.stringify(canonical));
    const byAlias = await resolveTarget(dc, SCHOOL, { type: 'Person', name: 'dela pena, joaquin' });
    check('an alias resolves, case and accents aside', byAlias.id === 'Person:P-c1', JSON.stringify(byAlias));
    const lone = await resolveTarget(dc, SCHOOL, { type: 'Person', name: 'Nestor Dela Peña' });
    check('a lone mention is its own node', lone.id === 'Person:P-m3', JSON.stringify(lone));
    const shared = await resolveTarget(dc, SCHOOL, { type: 'Person', name: 'Dela Peña' });
    check('a part of two titles resolves to neither and says both', !!shared.why && shared.why.includes('2 titles'), shared.why);
    const only = await resolveTarget(dc, SCHOOL, { type: 'Incident', only: true });
    check('"only" picks the single object of its type', only.id === 'Incident:I-1', JSON.stringify(only));
    const notOnly = await resolveTarget(dc, SCHOOL, { type: 'Person', only: true });
    check('"only" refuses when there are two', !!notOnly.why && notOnly.why.startsWith('2 Person'), notOnly.why);
    const account = await resolveTarget(dc, SCHOOL, { type: 'DigitalAccount', name: 'Vesper_Krael' });
    check('a handle resolves to its own account, not the look-alike', account.id === 'DigitalAccount:A-1', JSON.stringify(account));
    check('plain() folds case, accents and spacing', plain('  DELA  PEÑA ') === 'dela pena');

    // 2. The school pack's items are created with the bodies Builder 3 asked for.
    const first = await seedSaved({ investigation: SCHOOL, engine: BASE, log: quiet });
    check('school: three items created, none left out', first.created.length === 3 && first.skipped.length === 0, `${first.created.length} created, ${first.skipped.map((s) => s.why).join('; ')}`);
    const schoolList = await listSaved(dc, SCHOOL);
    const chain = byName(schoolList, 'Firearm chain');
    const voidhouse = byName(schoolList, 'VOIDHOUSE and the deleted messages');
    const hours = byName(schoolList, 'The 72 hours');
    check('school: the three names are listed at the top level', !!chain && !!voidhouse && !!hours && [chain, voidhouse, hours].every((s) => s.folderId === ''));
    const chainBody = (await getSaved(dc, chain.id)).body;
    check('Firearm chain: graph from the canonical person to the only incident', chain.kind === 'graph' && JSON.stringify(chainBody) === JSON.stringify({ nodes: [], focus: 'Person:P-c1', to: 'Incident:I-1' }), JSON.stringify(chainBody));
    const voidBody = (await getSaved(dc, voidhouse.id)).body;
    check('VOIDHOUSE: graph on the server with no "to"', voidhouse.kind === 'graph' && JSON.stringify(voidBody) === JSON.stringify({ nodes: [], focus: 'OnlineGroup:G-1', to: null }), JSON.stringify(voidBody));
    const hoursBody = (await getSaved(dc, hours.id)).body;
    const wantHours = { subjects: ['Person:P-c1', 'DigitalAccount:A-1'], hops: 2, from: '2026-09-13T18:00:00+08:00', until: '2026-09-16T18:00:00+08:00' };
    check('The 72 hours: timeline on the person and the moderator, two hops, Manila range', hours.kind === 'timeline' && JSON.stringify(hoursBody) === JSON.stringify(wantHours), JSON.stringify(hoursBody));

    // 3. Nothing to resolve against: every item left out, each saying which name.
    const empty = await seedSaved({ investigation: WASTE, engine: BASE, log: quiet });
    check('waste with no objects: both items left out and named', empty.created.length === 0 && empty.skipped.length === 2 && empty.skipped.every((s) => s.why.includes('Mabansag Hauling Services')), empty.skipped.map((s) => `${s.name}: ${s.why}`).join('; '));
    check('waste with no objects: nothing written', (await listSaved(dc, WASTE)).items.length === 0);

    // 4. A second run changes nothing: same count, same ids, no new audit row.
    const again = await seedSaved({ investigation: SCHOOL, engine: BASE, log: quiet });
    const listAgain = await listSaved(dc, SCHOOL);
    check('school again: three kept, none created, still three listed', again.unchanged.length === 3 && again.created.length === 0 && again.updated.length === 0 && listAgain.items.length === 3);
    const chainAudit = await audit(dc, chain.id);
    check('school again: the item has its one createSaved row and nothing else', chainAudit.length === 1 && chainAudit[0].action === 'createSaved', chainAudit.map((e) => e.action).join(', '));

    // 5. The data moves under the items: a re-resolution replaces the canonical person, and the hauler arrives.
    await stopEngine(engine);
    engine = null;
    plant(
      [
        school('Person', { personId: 'P-c2', fullName: 'Joaquin Dela Peña', aliases: ['DELA PENA, JOAQUIN', 'J. M. Dela Peña', 'Wacky'], role: 'subject' }),
        school('Person', { personId: 'P-m1', fullName: 'DELA PENA, JOAQUIN', aliases: [], passageId: 'PS-1', canonicalId: 'P-c2' }),
        school('Person', { personId: 'P-m2', fullName: 'Joaquin Dela Peña', aliases: [], passageId: 'PS-2', canonicalId: 'P-c2' }),
        waste('Hauler', { haulerId: 'H-1', name: 'Mabansag Hauling Services', aliases: ['Mabansag Hauling Svcs., Inc.', 'Mabansag Hauling'] }),
        waste('Hauler', { haulerId: 'H-2', name: 'Mabansay Waste Haulers', aliases: [], passageId: 'PS-9' }),
      ],
      [['Person', 'P-c1']],
    );
    engine = await startEngine();
    const dc2 = await connect(BASE);
    const moved = await seedSaved({ investigation: SCHOOL, engine: BASE, log: quiet });
    check('school after re-resolution: two items updated, VOIDHOUSE kept, none created', moved.updated.length === 2 && moved.unchanged.length === 1 && moved.created.length === 0, `${moved.updated.map((u) => u.name).join(', ')} updated; ${moved.unchanged.map((u) => u.name).join(', ')} kept`);
    const chainMoved = await getSaved(dc2, chain.id);
    check('Firearm chain: same id, focus follows the new canonical', chainMoved.id === chain.id && chainMoved.body.focus === 'Person:P-c2' && chainMoved.body.to === 'Incident:I-1', JSON.stringify(chainMoved.body));
    const hoursMoved = await getSaved(dc2, hours.id);
    check('The 72 hours: first subject follows the new canonical, the rest unchanged', hoursMoved.body.subjects[0] === 'Person:P-c2' && hoursMoved.body.subjects[1] === 'DigitalAccount:A-1' && hoursMoved.body.hops === 2, JSON.stringify(hoursMoved.body));
    const chainAudit2 = await audit(dc2, chain.id);
    check('Firearm chain: the update is one audited body change', chainAudit2.length === 2 && chainAudit2.some((e) => e.action === 'updateSavedBody'), chainAudit2.map((e) => e.action).join(', '));
    check('school: still three items, no duplicates', (await listSaved(dc2, SCHOOL)).items.length === 3);

    const haulers = await seedSaved({ investigation: WASTE, engine: BASE, log: quiet });
    const wasteList = await listSaved(dc2, WASTE);
    const one = byName(wasteList, 'One hauler, three LGUs');
    const contracts = byName(wasteList, 'Contracts and inspections');
    check('waste: both items created once the hauler is there', haulers.created.length === 2 && haulers.skipped.length === 0 && !!one && !!contracts, haulers.skipped.map((s) => s.why).join('; '));
    const oneBody = (await getSaved(dc2, one.id)).body;
    check('One hauler, three LGUs: focus on Mabansag, not the look-alike Mabansay', JSON.stringify(oneBody) === JSON.stringify({ nodes: [], focus: 'Hauler:H-1', to: null }), JSON.stringify(oneBody));
    const contractsBody = (await getSaved(dc2, contracts.id)).body;
    check('Contracts and inspections: the hauler, two hops, no range', JSON.stringify(contractsBody) === JSON.stringify({ subjects: ['Hauler:H-1'], hops: 2, from: null, until: null }), JSON.stringify(contractsBody));

    // 6. The pack files themselves say what Builder 3 asked for.
    const schoolItems = readPackSaved(SCHOOL);
    const wasteItems = readPackSaved(WASTE);
    check('saved.json: school names three items, waste names two', schoolItems.length === 3 && wasteItems.length === 2 && schoolItems.every((i) => i.kind && i.name) && wasteItems.every((i) => i.kind && i.name));
  } finally {
    await stopEngine(engine);
    clean();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
