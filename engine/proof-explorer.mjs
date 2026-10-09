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
import { decodeExploration, encodeExploration, startExploration, withStep } from '../src/data/exploration.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REAL = process.argv.includes('--real');
const PORT = REAL ? Number(process.env.BARGHEST_ENGINE_PORT ?? 8787) : 8789;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-explorer.sqlite';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off' };
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

  // 7. The object view of the "took" Relationship carries the M-0188 passage text
  const view = await getObjectView(dc, 'Relationship', 'R-001');
  const text = view.passages.map((p) => p.text).join(' ');
  check(`7 object view of R-001 returns the M-0188 passage text${tag}`, text.includes('nakuha ko na'), view.passages.map((p) => p.pk).join(', '));

  return { p1 };
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

    // 10. Restart, then checks 2 to 7 again
    await stopEngine(engine);
    engine = await startEngine();
    const dc2 = await connect(BASE);
    await seededChecks(dc2, 'after restart');
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

  const haulers = await fetchRows(dc, withStep(startExploration('Hauler'), filterStep('canonicalId', 'isEmpty')));
  const jrm = haulers.rows.find((r) => /jrm/i.test(r.title));
  const hv = jrm ? await getObjectView(dc, 'Hauler', jrm.pk) : null;
  check('the hauler resolves to one Hauler with three candidates', !!hv && hv.candidates.length === 3, hv ? `${hv.title}: ${hv.candidates.length} candidates` : 'no canonical JRM hauler');

  const answers = join(root, 'data', 'scenario-a', 'ANSWERS.md');
  check('ANSWERS.md is present to check the planted links against', existsSync(answers), answers.replace(root + '/', ''));
}

if (REAL) await realProof();
else await seededProof();

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:explorer: FAIL (${failed.length} of ${results.length})` : `proof:explorer: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
