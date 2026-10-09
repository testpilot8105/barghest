// P3 proof (pnpm proof:explorer): the Object Explorer data layer, the same TypeScript the screens use, run under
// Node with the real @osdk/client over HTTP against the engine on a throwaway seeded database. The ten checks of
// the plumbing handoff, then an engine restart and checks 2 to 7 again. With --real it checks structure against
// the running engine's own database (extracted data, seed off). Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '../src/data/client.ts';
import { countRows, fetchRows, getObjectView, histogram, searchAll, searchAround, toObjectSet } from '../src/data/reads.ts';
import { extractAgain, fetchInferenceLog, getHealth, importFile, mergeInferenceRows } from '../src/data/intake.ts';
import { decodeExploration, encodeExploration, startExploration, withStep } from '../src/data/exploration.ts';

// The demo investigation the engine creates at its first start; the seed's objects carry it.
const DEMO_INVESTIGATION = 'school-incident';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REAL = process.argv.includes('--real');
const PORT = REAL ? Number(process.env.BARGHEST_ENGINE_PORT ?? 8787) : 8789;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-explorer.sqlite';
const FILES = 'data/proof-explorer-files';
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
const cleanDb = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
  rmSync(join(root, FILES), { recursive: true, force: true });
};

const filterStep = (property, op, value) => ({ filter: { property, op, value } });
const pivot = (link) => ({ pivot: link });

async function seededChecks(dc, pass) {
  const tag = pass ? ` [${pass}]` : '';

  // 2. Person where fullName contains "Dela"
  const dela = await fetchRows(dc, withStep(startExploration('Person'), filterStep('fullName', 'contains', 'Dela')));
  check(`2 Person fullName contains "Dela" returns P-001, P-007, P-010${tag}`, same(dela.rows.map((r) => r.pk).sort(), ['P-001', 'P-007', 'P-010']), dela.rows.map((r) => r.pk).join(', '));

  // 3. DigitalAccount histogram by platform
  const h = await histogram(dc, startExploration('DigitalAccount'), 'platform');
  const got = Object.fromEntries(h.buckets.map((b) => [b.bucket, b.count]));
  const want = { Roblox: 3, Discord: 3, 'Facebook Messenger': 2, TikTok: 1, Telegram: 1, Facebook: 1 };
  check(`3 DigitalAccount histogram by platform${tag}`, same(got, { ...want, ...got }) && Object.keys(got).length === 6 && h.total === 11, JSON.stringify(got));

  // 4. DigitalAccount sorted by handle, 5 per page
  const exp4 = { ...startExploration('DigitalAccount', 5), sort: { property: 'handle', direction: 'asc' } };
  const pages = [];
  let token;
  do {
    const page = await fetchRows(dc, exp4, token);
    pages.push(page);
    token = page.nextPageToken;
  } while (token && pages.length < 10);
  const rows4 = pages.flatMap((p) => p.rows);
  const handles = rows4.map((r) => String(r.properties.handle));
  const sorted = [...handles].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  check(`4 DigitalAccount by handle, 5 per page: 3 pages, 11 rows, no repeats${tag}`, pages.length === 3 && rows4.length === 11 && new Set(rows4.map((r) => r.pk)).size === 11 && same(handles, sorted), `${pages.length} pages, ${rows4.length} rows: ${handles.join(' | ')}`);

  // 5. Search Around from P-001
  const p1 = withStep(startExploration('Person'), filterStep('personId', 'eq', 'P-001'));
  const around = await searchAround(dc, p1);
  const links = dc.catalog.types.Person.links.map((l) => l.apiName).sort();
  const accounts = around.find((a) => a.link === 'digitalAccounts');
  check(`5 Search Around from P-001 lists every Person link, digitalAccounts counts 4${tag}`, same(around.map((a) => a.link).sort(), links) && accounts?.count === 4, `${around.length} links, digitalAccounts ${accounts?.count}`);

  // 6. Three hops
  const hops = withStep(withStep(withStep(p1, pivot('relationshipsFrom')), pivot('toFirearm')), pivot('custodian'));
  const custodians = await fetchRows(dc, hops);
  check(`6 P-001 -> relationshipsFrom -> toFirearm -> custodian returns P-007${tag}`, same(custodians.rows.map((r) => r.pk), ['P-007']), custodians.rows.map((r) => r.title).join(', '));

  // 6b. A many-to-one pivot returns distinct objects (reported by the shell session): 11 accounts to 4 owners
  const owners = withStep(startExploration('DigitalAccount'), pivot('owner'));
  const ownerRows = await fetchRows(dc, owners);
  const ownerCount = await countRows(dc, owners);
  const ownerHist = await histogram(dc, owners, 'role');
  const back = await searchAround(dc, withStep(owners, filterStep('personId', 'eq', 'P-001')));
  check(`6b DigitalAccount -> owner returns 4 distinct people, count 4, histogram total 4, round trip 4${tag}`, ownerRows.rows.length === 4 && new Set(ownerRows.rows.map((r) => r.pk)).size === 4 && ownerCount === 4 && ownerHist.total === 4 && back.find((b) => b.link === 'digitalAccounts')?.count === 4, `${ownerRows.rows.length} rows, count ${ownerCount}, histogram ${ownerHist.total}, accounts back ${back.find((b) => b.link === 'digitalAccounts')?.count}`);

  // 7. The object view of the "took" Relationship carries the M-0188 passage text
  const view = await getObjectView(dc, 'Relationship', 'R-001');
  const text = view.passages.map((p) => p.text).join(' ');
  check(`7 object view of R-001 returns the M-0188 passage text${tag}`, text.includes('nakuha ko na'), view.passages.map((p) => p.pk).join(', '));

  return { p1 };
}

/** The intake calls the Files and Data Sources views make (engine-api.md 2.5), model off. */
async function intakeChecks(dc) {
  // I1. Health: the model is off for this engine, nothing is extracting, txt is accepted
  const h = await getHealth(dc);
  check('I1 getHealth: model off, nothing extracting, txt accepted', h.ok === true && h.ollama === null && Array.isArray(h.extracting) && h.extracting.length === 0 && h.formats.includes('txt'), `extracting ${JSON.stringify(h.extracting)}, formats ${h.formats.join(', ')}`);

  // I2. Histogram on Document.system before the import: the seed's one register
  const before = await histogram(dc, startExploration('Document'), 'system');
  check('I2 histogram on Document.system groups the seed document by its register', before.total === 1 && before.buckets.length === 1 && before.buckets[0].bucket === 'PNP-ACG Cyber Forensics', JSON.stringify(before.buckets));

  // I3. importFile over POST import, with the model off, so the file is stored and not read
  const text = 'Proof of intake. The register is Proof register and the file is intake-check.txt. Nothing here names anyone.';
  const file = new File([text], 'intake-check.txt', { type: 'text/plain' });
  const imported = await importFile(dc, { file, investigation: DEMO_INVESTIGATION, system: 'Proof register', extract: false });
  check('I3 importFile returns a Document id, one passage, extraction off', typeof imported.documentId === 'string' && imported.documentId.startsWith('D-') && imported.passages === 1 && imported.extraction === 'off', JSON.stringify(imported));

  // I4. The Document filter by scenario: the seed's document and the imported file share the demo id; another id has none
  const byInvestigation = await fetchRows(dc, withStep(startExploration('Document'), filterStep('scenario', 'eq', DEMO_INVESTIGATION)));
  const elsewhere = await fetchRows(dc, withStep(startExploration('Document'), filterStep('scenario', 'eq', 'no-such-investigation')));
  check('I4 Document filtered by scenario returns the seed document and the imported file; an unknown id returns none', same(byInvestigation.rows.map((r) => r.pk).sort(), ['D-001', imported.documentId].sort()) && elsewhere.rows.length === 0, `${byInvestigation.rows.map((r) => r.title).join(', ') || 'no rows'}; unknown id ${elsewhere.rows.length}`);

  // I5. The register histogram now has two buckets
  const after = await histogram(dc, startExploration('Document'), 'system');
  const regs = Object.fromEntries(after.buckets.map((b) => [b.bucket, b.count]));
  check('I5 histogram on Document.system now shows both registers, one file each', after.total === 2 && regs['Proof register'] === 1 && regs['PNP-ACG Cyber Forensics'] === 1, JSON.stringify(regs));

  // I6. extractAgain reaches POST extract and is refused while the model is off, with the status a screen needs
  const refused = await extractAgain(dc, imported.documentId).then(() => null, (e) => e);
  check('I6 extractAgain is refused with 503 while the model is off', refused?.status === 503 && /model is off/.test(refused?.message ?? ''), refused ? `${refused.status} ${refused.message}` : 'not refused');

  // I7. fetchInferenceLog answers a list (empty: no model call was made); the merge keeps id order without repeats
  const log = await fetchInferenceLog(dc, 0);
  const row = (id) => ({ id, at: '', model: 'm', purpose: 'extract', documentId: null, passageId: null, promptHash: '', latencyMs: 0, promptTokens: null, outputTokens: null, ok: true });
  const merged = mergeInferenceRows(mergeInferenceRows([], [row(2), row(1)]), [row(2), row(4), row(3)]);
  const again = mergeInferenceRows(merged, [row(3)]);
  check('I7 inference log is a list; merge keeps id order, drops repeats and older rows', Array.isArray(log) && log.length === 0 && same(merged.map((r) => r.id), [1, 2, 3, 4]) && same(again.map((r) => r.id), [1, 2, 3, 4]), `${log.length} rows logged, merged ${merged.map((r) => r.id).join(',')}`);

  return { documentId: imported.documentId };
}

async function seededProof() {
  cleanDb();
  await run('engine/dev-seed.mjs');
  let engine = await startEngine();
  try {
    const dc = await connect(BASE);

    // 1. Catalog
    const types = Object.keys(meta.objectTypes);
    const missing = types.filter((t) => !dc.catalog.types[t]);
    const incomplete = types.filter((t) => {
      const d = dc.catalog.types[t];
      return !d || !d.titleProperty || !d.displayName || !d.pluralDisplayName || d.properties.some((p) => !p.displayName) || d.links.some((l) => !l.displayName);
    });
    check('1 catalog lists every type with title property and display names', missing.length === 0 && incomplete.length === 0, `${Object.keys(dc.catalog.types).length} types${incomplete.length ? ', incomplete: ' + incomplete.join(', ') : ''}`);

    const { p1 } = await seededChecks(dc);

    // 8. Every filter operation in the catalog runs without error
    const samples = {
      string: ['Person', 'fullName', { eq: 'Joaquin Dela Peña', in: ['Joaquin Dela Peña', 'Marco Villarin'], contains: 'Dela' }],
      array: ['Person', 'aliases', { contains: 'Wacky' }],
      double: ['Relationship', 'confidence', { eq: 0.9, in: [0.9, 0.95], range: { min: 0.5, max: 1 } }],
      integer: ['Passage', 'index', { eq: 1, in: [0, 1], range: { min: 0, max: 5 } }],
      timestamp: ['Relationship', 'observedAt', { range: { min: '2026-01-01T00:00:00Z', max: '2026-12-31T00:00:00Z' } }],
    };
    const failures = [];
    for (const [dataType, [type, property, values]] of Object.entries(samples)) {
      const ops = dc.catalog.types[type].properties.find((p) => p.apiName === property)?.filterOps ?? [];
      for (const op of ops) {
        const value = op === 'isEmpty' ? undefined : values[op];
        if (op !== 'isEmpty' && value === undefined) continue;
        try {
          const page = await fetchRows(dc, withStep(startExploration(type), filterStep(property, op, value)));
          if (op === 'eq' || op === 'in' || op === 'contains' || op === 'range') {
            if (page.rows.length === 0) failures.push(`${dataType}.${op}: no rows`);
          }
        } catch (e) {
          failures.push(`${dataType}.${op}: ${e?.message ?? e}`);
        }
      }
    }
    check('8 every filter operation in the catalog runs without error', failures.length === 0, failures.join('; ') || 'eq, in, contains, range, isEmpty on string, array, double, integer, timestamp');

    // 9. Encode then decode
    const exp9 = { ...withStep(withStep(p1, pivot('digitalAccounts')), filterStep('platform', 'eq', 'Discord')), sort: { property: 'handle', direction: 'asc' }, pageSize: 50 };
    const roundTrip = decodeExploration(encodeExploration(exp9));
    check('9 an exploration survives encode then decode unchanged', same(roundTrip, exp9), encodeExploration(exp9).slice(0, 40) + '...');

    // Extras the screens lean on
    const n = await countRows(dc, startExploration('Person'));
    check('count Person is 10', n === 10, `${n}`);
    const all = await searchAll(dc, 'Dela');
    check('searchAll("Dela") finds 3 people and 1 relationship', all.Person?.count === 3 && all.Relationship?.count === 1, `Person ${all.Person?.count}, Relationship ${all.Relationship?.count}`);
    const pv = await getObjectView(dc, 'Person', 'P-001');
    check('object view of P-001: 4 accounts, 1 relationship out, 1 resolution', pv.links.find((l) => l.link === 'digitalAccounts')?.count === 4 && pv.relationships.out.length === 1 && pv.resolutions.length === 1, `${pv.links.length} link groups`);

    // Intake (engine-api.md 2.5): import, the register histogram, the scenario filter, extract, the model log
    const { documentId } = await intakeChecks(dc);

    // 10. Restart, then checks 2 to 7 again
    await stopEngine(engine);
    engine = await startEngine();
    const dc2 = await connect(BASE);
    await seededChecks(dc2, 'after restart');
    const docs = await fetchRows(dc2, startExploration('Document'));
    check('the imported Document survives the restart', docs.rows.length === 2 && docs.rows.some((r) => r.pk === documentId), docs.rows.map((r) => r.title).join(', '));
  } catch (e) {
    check('no exception', false, e?.message ?? String(e));
    console.error(e);
  } finally {
    await stopEngine(engine);
    cleanDb();
  }
}

async function realProof() {
  if (!(await health())) {
    check('engine is running on ' + BASE, false, 'start it with pnpm dev:engine');
    return;
  }
  const dc = await connect(BASE);
  const empty = [];
  for (const type of dc.catalog.order) {
    const n = await countRows(dc, startExploration(type));
    if (n === 0) empty.push(type);
  }
  check('every type in the catalog has at least one object', empty.length === 0, empty.length ? 'empty: ' + empty.join(', ') : `${dc.catalog.order.length} types`);

  const { os } = toObjectSet(dc, startExploration('Relationship'));
  const rels = await os.fetchPage({ $pageSize: 1000 });
  const bare = rels.data.filter((r) => !(r.passageIds?.length));
  check('every Relationship has at least one passage', bare.length === 0, `${rels.data.length} relationships, ${bare.length} without`);

  const p1 = await getObjectView(dc, 'Person', 'P-001').catch(() => null);
  check("P-001's object view lists seven representations", (p1?.candidates.length ?? 0) >= 7, `${p1?.candidates.length ?? 'no P-001'} candidates`);

  // The pack's hauler is Mabansag Hauling Services, under several spellings (the look-alike Mabansay stays apart).
  const haulers = await fetchRows(dc, withStep(startExploration('Hauler'), filterStep('canonicalId', 'isEmpty')));
  const mabansag = haulers.rows.find((r) => /mabansag/i.test(r.title));
  const hv = mabansag ? await getObjectView(dc, 'Hauler', mabansag.pk) : null;
  check('the hauler resolves to one Hauler with at least three candidates', !!hv && hv.candidates.length >= 3, hv ? `${hv.title}: ${hv.candidates.length} candidates` : 'no canonical Mabansag hauler');

  const answers = join(root, 'data', 'school-incident', 'ANSWERS.md');
  check('ANSWERS.md is present to check the planted links against', existsSync(answers), answers.replace(root + '/', ''));
}

if (REAL) await realProof();
else await seededProof();

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:explorer: FAIL (${failed.length} of ${results.length})` : `proof:explorer: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
