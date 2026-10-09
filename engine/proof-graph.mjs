// P8 proof (pnpm proof:graph): what-connects and timeline over HTTP against the engine on a throwaway seeded
// database. P-001 reaches the incident through the firearm and the evidence tag, with the relationship and its
// passage on the path; a timeline reads in time order with its tags. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8791;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-graph.sqlite';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off' };

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
function run(script) {
  return new Promise((res, rej) => {
    const c = spawn('node', [script], { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
    c.once('exit', (code) => (code === 0 ? res() : rej(new Error(`${script} exited ${code}`))));
  });
}
const cleanDb = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
};
const get = (path) => fetch(`${BASE}${path}`).then(async (r) => ({ status: r.status, body: await r.json() }));

cleanDb();
await run('engine/dev-seed.mjs');
let engine = await startEngine();
try {
  const a = await get('/barghest/what-connects?from=Person:P-001&to=Incident:I-001');
  const objs = a.body.objects?.map((o) => `${o.type}:${o.pk}`) ?? [];
  const routes = a.body.paths?.map((p) => p.objects.map((o) => o.pk).join('>')) ?? [];
  check('P-001 to I-001: paths are found', a.status === 200 && a.body.found === true && a.body.paths.length >= 2, `${a.body.paths?.length} paths: ${routes.join(' | ')}`);
  check('the shortest is through the school, and the firearm chain is there too', routes[0] === 'P-001>S-001>I-001' && objs.includes('Firearm:F-001') && objs.includes('EvidenceItem:E-001'));
  check('the "took" relationship is on a path with its passage', a.body.relationships?.some((r) => r.pk === 'R-001') && a.body.passages?.some((p) => p.text.includes('nakuha ko na')), `${a.body.relationships?.length} relationships, ${a.body.passages?.length} passages`);

  const b = await get('/barghest/what-connects?from=Person:P-001&to=OnlineGroup:G-002');
  check('P-001 to VOIDHOUSE goes through the Discord account and member_of', b.body.found && b.body.objects.some((o) => o.pk === 'A-003') && b.body.relationships.some((r) => r.kind === 'member_of'), b.body.objects?.map((o) => o.pk).join(' > '));

  const c = await get('/barghest/what-connects?from=Person:P-001&to=Person:P-010');
  check('no path is reported honestly (P-010 is linked to nothing in the seed)', c.status === 200 && c.body.found === false && c.body.objects.length === 0);

  const d = await get('/barghest/what-connects?from=Person:P-001&to=Person:NOPE');
  check('an unknown object is a 404', d.status === 404);

  const t = await get('/barghest/timeline?objectId=Person:P-001&hops=2');
  const ats = t.body.events?.map((e) => e.at) ?? [];
  const sorted = [...ats].sort();
  check('timeline of P-001 (2 hops) reads in time order', t.status === 200 && ats.length >= 3 && JSON.stringify(ats) === JSON.stringify(sorted), `${ats.length} events`);
  const kinds = t.body.events?.map((e) => `${e.kind}@${e.tag}`) ?? [];
  check('it carries the took, member_of and groomed_by relationships as observed', ['took', 'member_of', 'groomed_by'].every((k) => kinds.includes(`${k}@observed`)), kinds.join(', '));
  const last = t.body.events?.[t.body.events.length - 1];
  check('the incident (2 hops, through the school) is the last event, after the "took" message', last?.id === 'Incident:I-001', `last ${last?.id}`);

  const t1 = await get('/barghest/timeline?objectId=Person:P-001&hops=1');
  check('at 1 hop the incident is absent and the "took" message is there', !t1.body.events.some((e) => e.id === 'Incident:I-001') && t1.body.events.some((e) => e.kind === 'took'), `${t1.body.events?.length} events`);

  const t7 = await get('/barghest/timeline?objectId=Person:P-007&hops=1');
  check("P-007's timeline (1 hop) sees the firearm leaving the locker", t7.body.events.some((e) => e.kind === 'took'), t7.body.events?.map((e) => e.id).join(', '));

  const e = await get('/barghest/timeline?objectId=Nope');
  check('a malformed objectId is a 400', e.status === 400);
} catch (e) {
  check('no exception', false, e?.message ?? String(e));
  console.error(e);
} finally {
  await stopEngine(engine);
  cleanDb();
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:graph: FAIL (${failed.length} of ${results.length})` : `proof:graph: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
