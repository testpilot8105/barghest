// Resolution proof (pnpm proof:resolve): hand-made mentions stand in for what extraction will write. Seven spellings
// of one student, three of one hauler, two Villarins who must stay apart, and a relationship written against one of
// the spellings. First with the model off (the 0.5 to 0.9 band stays for review), then with a stand-in decide() that
// says "same", so both paths of the plumbing are proven without Ollama. Exit 1 on any failure.
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { createEngine, toServerObject } from './faux.mjs';
import { createActionImpls } from './actions.mjs';
import { resolveScenario } from './resolve/index.mjs';
import { candidatePairs } from './resolve/pairs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = join(root, 'data', 'proof-resolve.sqlite');
for (const suffix of ['', '-wal', '-shm']) rmSync(DB + suffix, { force: true });
const meta = JSON.parse(readFileSync(join(root, 'ontology', 'ontology.json'), 'utf8'));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const store = openStore(DB);
const engine = createEngine({ meta, store, baseUrl: 'http://localhost:0', actionImpls: createActionImpls(meta) });
const data = engine.data;

// Mentions: one per passage, as extraction writes them.
const people = [
  ['M-P1', 'Joaquin Dela Peña', 'PS-1'],
  ['M-P2', 'DELA PENA, JOAQUIN', 'PS-2'],
  ['M-P3', 'J. Dela Peña', 'PS-3'],
  ['M-P4', 'Joaquin Dela Pena', 'PS-4'],
  ['M-P5', 'Dela Peña, Joaquin', 'PS-5'],
  ['M-P6', 'JOAQUIN DELA PEÑA', 'PS-6'],
  ['M-P7', 'Joaquin D. Dela Peña', 'PS-7'],
  ['M-P8', 'Marco Villarin', 'PS-8'],
  ['M-P9', 'Ramon Villarin', 'PS-9'],
  ['M-P10', 'PSSg Rowena Dela Peña', 'PS-10'],
];
const haulers = [
  ['M-H1', 'JRM Hauling Services', 'PS-11'],
  ['M-H2', 'J.R.M. Hauling Svcs., Inc.', 'PS-12'],
  ['M-H3', 'JRM Hauling', 'PS-13'],
  ['M-H4', 'Greenfields Waste Management Corp.', 'PS-14'],
];
const passages = [...people, ...haulers].map(([, name, ps]) => toServerObject(meta, 'Passage', { passageId: ps, label: ps, documentId: 'D-proof', index: 0, text: `...${name}...`, charStart: 0, charEnd: 10 }));
const objs = [
  toServerObject(meta, 'Document', { documentId: 'D-proof', title: 'proof fixture', format: 'txt', system: 'proof', scenario: 'a', importedAt: new Date().toISOString(), status: 'imported' }),
  ...passages,
  ...people.map(([pk, name, ps]) => toServerObject(meta, 'Person', { personId: pk, fullName: name, aliases: [], role: 'mention', passageId: ps, scenario: 'a' })),
  ...haulers.map(([pk, name, ps]) => toServerObject(meta, 'Hauler', { haulerId: pk, name, passageId: ps, scenario: 'b' })),
  toServerObject(meta, 'Firearm', { firearmId: 'M-F1', label: 'Glock 17 BHPZ417', serial: 'BHPZ417', passageId: 'PS-3', scenario: 'a' }),
  toServerObject(meta, 'Relationship', {
    relationshipId: 'M-R1', label: 'J. Dela Peña took Glock 17', kind: 'took', fromType: 'Person', fromId: 'M-P3', toType: 'Firearm', toId: 'M-F1',
    fromPersonId: 'M-P3', toFirearmId: 'M-F1', confidence: 0.9, method: 'extracted', status: 'proposed', passageIds: ['PS-3'], recordIds: [], scenario: 'a',
  }),
];
engine.put(objs);

try {
  // The pairs themselves
  const pairs = candidatePairs('Person', [...data.getObjectsOfType('Person')]);
  const villarins = pairs.find((p) => [p.a.fullName, p.b.fullName].every((n) => /Villarin/.test(n)));
  const rowena = pairs.find((p) => [p.a.fullName, p.b.fullName].some((n) => /Rowena/.test(n)));
  check('Marco and Ramon Villarin are never paired', !villarins, villarins ? `${villarins.score}` : 'no pair');
  check('Rowena Dela Peña is not paired with Joaquin above the review band', !rowena || rowena.score < 0.9, rowena ? `${rowena.score}: ${rowena.reasons.join('; ')}` : 'no pair');
  const initials = pairs.find((p) => [p.a.fullName, p.b.fullName].includes('J. Dela Peña') && [p.a.fullName, p.b.fullName].includes('Joaquin Dela Peña'));
  check('"J. Dela Peña" vs "Joaquin Dela Peña" lands in the model band (0.5 to 0.9)', !!initials && initials.score >= 0.5 && initials.score < 0.9, initials ? `${initials.score}: ${initials.reasons.join('; ')}` : 'no pair');

  // Model off
  const r1 = await resolveScenario({ engine, meta, store, scenario: 'a', decide: null, types: ['Person', 'Firearm'] });
  const people1 = [...data.getObjectsOfType('Person')];
  const canon1 = people1.filter((p) => !p.canonicalId && !p.passageId);
  const joaquin1 = canon1.find((p) => /joaquin/i.test(p.fullName));
  const members1 = people1.filter((p) => p.canonicalId === joaquin1?.__primaryKey);
  check('model off: six spellings resolve by rule, the initialled one waits for review', !!joaquin1 && members1.length === 6 && r1.summary.Person.reviewPairs >= 1, `${members1.length} members, ${r1.summary.Person.reviewPairs} review pairs`);
  const reviews = [...data.getObjectsOfType('Resolution')].filter((r) => r.decision === 'review');
  check('review pairs are Resolution rows with decidedBy pending', reviews.length >= 1 && reviews.every((r) => r.decidedBy === 'pending'), `${reviews.length} rows`);

  // Model on (stand-in for the local model): a pair is the same person when neither side is a different first name
  const isJoaquin = (n) => /joaquin|^j\./i.test(n);
  const decide = async (band) => band.map((p) => {
    const same = isJoaquin(p.a.fullName) && isJoaquin(p.b.fullName);
    return { same, confidence: same ? 0.92 : 0.95, reason: `stand-in: ${p.a.fullName} and ${p.b.fullName} are ${same ? 'one person' : 'different people'}` };
  });
  const r2 = await resolveScenario({ engine, meta, store, scenario: 'a', decide, types: ['Person', 'Firearm'] });
  const people2 = [...data.getObjectsOfType('Person')];
  const canon2 = people2.filter((p) => !p.canonicalId && !p.passageId);
  const joaquin = canon2.find((p) => /joaquin/i.test(p.fullName));
  check('the canonical title is the clean "First Last" spelling', joaquin?.fullName === 'Joaquin D. Dela Peña' || joaquin?.fullName === 'Joaquin Dela Peña', joaquin?.fullName);
  const members = people2.filter((p) => p.canonicalId === joaquin?.__primaryKey);
  check('seven representations resolve to one Person', !!joaquin && members.length === 7, `${joaquin?.fullName}: ${members.length} candidates, ${canon2.length} canonical people`);
  check('the canonical Person keeps every spelling as an alias', (joaquin?.aliases?.length ?? 0) >= 5, (joaquin?.aliases ?? []).join(' | '));
  check('the stale canonical object from the model-off run is gone after the re-run', !!joaquin1 && !!joaquin && (joaquin1.__primaryKey === joaquin.__primaryKey || !people2.some((p) => p.__primaryKey === joaquin1.__primaryKey)), `${canon2.length} canonical`);
  check('Villarins and Rowena stay their own people', people2.filter((p) => /Villarin|Rowena/.test(p.fullName) && !p.canonicalId).length === 3);

  const res = [...data.getObjectsOfType('Resolution')].filter((r) => r.canonicalType === 'Person' && r.canonicalId === joaquin?.__primaryKey);
  const methods = new Set(res.map((r) => r.decidedBy));
  check('each Resolution names its method; both rule and local-model appear', res.length >= 6 && res.every((r) => r.method && r.decidedBy) && methods.has('rule') && methods.has('local-model'), `${res.length} rows: ${[...methods].join(', ')}`);
  check('no Resolution is left at review after the model decided', ![...data.getObjectsOfType('Resolution')].some((r) => r.decision === 'review' && r.canonicalType === 'Person'), `${r2.summary.Person.reviewPairs} review`);

  const rel = data.getObject('Relationship', 'M-R1');
  check('the relationship points at the canonical Person and keeps the mention in fromId', rel.fromPersonId === joaquin?.__primaryKey && rel.fromId === 'M-P3', `${rel.fromId} -> ${rel.fromPersonId}`);
  const viaLink = data.getLinksOrThrow('Person', joaquin.__primaryKey, 'relationshipsFrom');
  check('faux walks Person -> relationshipsFrom from the canonical object', viaLink.length === 1 && viaLink[0].__primaryKey === 'M-R1');
  const cands = data.getLinksOrThrow('Person', joaquin.__primaryKey, 'candidates');
  check('faux walks Person -> candidates to all seven mentions', cands.length === 7, `${cands.length}`);

  // Haulers
  const rh = await resolveScenario({ engine, meta, store, scenario: 'b', decide: null, types: ['Hauler'] });
  const hs = [...data.getObjectsOfType('Hauler')];
  const jrm = hs.find((h) => !h.canonicalId && !h.passageId && /jrm/i.test(h.name));
  const jrmMembers = hs.filter((h) => h.canonicalId === jrm?.__primaryKey);
  check('three hauler spellings resolve to one Hauler with three candidates, by rule alone', !!jrm && jrmMembers.length === 3 && rh.summary.Hauler.reviewPairs === 0, `${jrm?.name}: ${jrmMembers.length}`);
  check('Greenfields stays apart', hs.some((h) => /Greenfields/.test(h.name) && !h.canonicalId));

  // Persistence: the rows are in SQLite, not only in memory
  const rows = store.all();
  check('canonical objects, members and resolutions are in SQLite', rows.some((o) => o.__primaryKey === joaquin.__primaryKey) && rows.filter((o) => o.__apiName === 'Resolution').length >= 7, `${rows.length} rows`);

  // Accounts to people: a full name in the display name is a rule call, "Joaquin DP" goes to the model
  engine.put([
    toServerObject(meta, 'DigitalAccount', { accountId: 'M-A1', platform: 'Facebook Messenger', handle: 'Joaquin DP', displayName: 'Joaquin DP', passageId: 'PS-1', scenario: 'a' }),
    toServerObject(meta, 'DigitalAccount', { accountId: 'M-A2', platform: 'Facebook Messenger', handle: 'marco.villarin', displayName: 'Marco Villarin', passageId: 'PS-8', scenario: 'a' }),
    toServerObject(meta, 'DigitalAccount', { accountId: 'M-A3', platform: 'Discord', handle: 'Vesper_Krael', displayName: 'Vesper_Krael', passageId: 'PS-1', scenario: 'a' }),
  ]);
  // The stand-in answers both kinds of question: person pairs as before, owner pairs by the display name.
  const ownerDecide = async (band) =>
    band.map((p) =>
      p.question
        ? { same: /joaquin/i.test(p.a.displayName ?? '') && /joaquin/i.test(p.b.fullName), confidence: 0.9, reason: `stand-in: ${p.question}` }
        : { same: isJoaquin(p.a.fullName) && isJoaquin(p.b.fullName), confidence: 0.92, reason: 'stand-in' },
    );
  const ro = await resolveScenario({ engine, meta, store, scenario: 'a', decide: ownerDecide, types: ['Person', 'DigitalAccount'] });
  const a1 = data.getObject('DigitalAccount', 'M-A1');
  const a2 = data.getObject('DigitalAccount', 'M-A2');
  const a3 = data.getObject('DigitalAccount', 'M-A3');
  check('"Joaquin DP" is offered to the model and becomes the canonical Joaquin\'s account', a1?.personId === joaquin.__primaryKey && ro.owners.modelPairs >= 1, `${a1?.personId} (${JSON.stringify(ro.owners)})`);
  check('"Marco Villarin" as a display name is a rule call', a2?.personId && /villarin/i.test(data.getObject('Person', a2.personId)?.fullName ?? '') && ro.owners.autoPairs >= 1, a2?.personId);
  check('"Vesper_Krael" matches nobody and stays ownerless', !a3?.personId);
  const ownerRes = [...data.getObjectsOfType('Resolution')].filter((r) => (r.candidateIds ?? []).includes('DigitalAccount:M-A1'));
  check('the ownership decision is a Resolution row naming its method', ownerRes.length === 1 && ownerRes[0].decidedBy === 'local-model' && /display name/.test(ownerRes[0].method), JSON.stringify(ownerRes.map((r) => ({ decidedBy: r.decidedBy, method: r.method, n: ownerRes.length }))));
  const viaOwner = data.getLinksOrThrow('Person', joaquin.__primaryKey, 'digitalAccounts');
  check('faux walks Person -> digitalAccounts to the newly owned account', viaOwner.some((a) => a.__primaryKey === 'M-A1'), `${viaOwner.length} accounts`);

  // Idempotent
  const r3 = await resolveScenario({ engine, meta, store, scenario: 'a', decide, types: ['Person', 'Firearm'] });
  const canon3 = [...data.getObjectsOfType('Person')].filter((p) => !p.canonicalId && !p.passageId);
  check('a re-run yields the same canonical id and no duplicates', canon3.length === canon2.length && canon3.some((p) => p.__primaryKey === joaquin.__primaryKey), `${canon3.length} canonical, ${r3.written} written`);
} catch (e) {
  check('no exception', false, e?.message ?? String(e));
  console.error(e);
} finally {
  store.close();
  for (const suffix of ['', '-wal', '-shm']) rmSync(DB + suffix, { force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:resolve: FAIL (${failed.length} of ${results.length})` : `proof:resolve: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
