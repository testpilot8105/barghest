// P1 proof (pnpm proof:p1): the real @osdk/client, over HTTP, against the engine on its own throwaway database.
// A Person created through an action is there after the engine restarts, the row is in SQLite (not just in the
// reply), the action is in the audit log, and the seed's 11 digital accounts count as 11. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@osdk/client';
import { openStore } from './store.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8788;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-p1.sqlite';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off' };
const meta = JSON.parse(readFileSync(join(root, 'ontology', 'ontology.json'), 'utf8'));

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
  const child = spawn('node', ['engine/server.mjs'], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'] });
  for (let i = 0; i < 100; i++) {
    if (await health()) return child;
    await sleep(100);
  }
  child.kill();
  throw new Error('engine did not come up on ' + BASE);
}
async function stopEngine(child) {
  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));
}
function run(script) {
  return new Promise((res, rej) => {
    const c = spawn('node', [script], { cwd: root, env, stdio: 'inherit' });
    c.once('exit', (code) => (code === 0 ? res() : rej(new Error(`${script} exited ${code}`))));
  });
}

const cleanDb = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
};

const client = createClient(BASE, meta.ontology.rid, async () => 'myAccessToken');
const Person = { type: 'object', apiName: 'Person' };
const DigitalAccount = { type: 'object', apiName: 'DigitalAccount' };
const createPerson = { type: 'action', apiName: 'createObjectPerson' };

cleanDb();
await run('engine/dev-seed.mjs');
let engine = await startEngine();
try {
  const h = await health();
  check('health answers with the ontology loaded', h?.ok === true && h.ontology?.types === Object.keys(meta.objectTypes).length, `${h?.ontology?.types} types`);

  const before = await client(Person).fetchPage({ $pageSize: 100 });
  check('seed people are served through @osdk/client', before.data.length === 10, `${before.data.length} people`);

  const applied = await client(createPerson).applyAction(
    { personId: 'P-TEST', fullName: 'Proof Person', role: 'test', aliases: ['proof'], scenario: 'proof' },
    { $returnEdits: true },
  );
  check('create-object-person applies', applied?.type === 'edits' && applied.addedObjects?.length === 1, JSON.stringify(applied?.addedObjects));

  const created = await client(Person).fetchOne('P-TEST');
  check('the new Person reads back over HTTP', created?.fullName === 'Proof Person', created?.$title);

  await stopEngine(engine);
  const store = openStore(join(root, DB));
  const row = store.all().find((o) => o.__apiName === 'Person' && o.__primaryKey === 'P-TEST');
  const audit = store.auditFor('Person:P-TEST');
  store.close();
  check('the row is in SQLite', row?.fullName === 'Proof Person', row ? `${row.__apiName}:${row.__primaryKey}` : 'no row');
  check('the action is in the audit log', audit.length === 1 && audit[0].action === 'createObjectPerson' && audit[0].outcome === 'applied', audit[0]?.outcome);

  engine = await startEngine();
  const again = await client(Person).fetchOne('P-TEST');
  check('the Person survives an engine restart', again?.fullName === 'Proof Person');

  const accounts = await client(DigitalAccount).aggregate({ $select: { $count: 'unordered' } });
  check('DigitalAccount counts 11 with the seed', accounts?.$count === 11, `count ${accounts?.$count}`);

  const viaHttp = await fetch(`${BASE}/barghest/audit?objectId=Person:P-TEST`).then((r) => r.json());
  check('GET /barghest/audit returns the action', Array.isArray(viaHttp) && viaHttp.length === 1, `${viaHttp.length} rows`);
} catch (e) {
  check('no exception', false, e?.message ?? String(e));
  console.error(e);
} finally {
  await stopEngine(engine);
  cleanDb();
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:p1: FAIL (${failed.length} of ${results.length})` : `proof:p1: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
