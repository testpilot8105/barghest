// P7 proof (node engine/proof-pack.mjs), model off, on throwaway engines: import:pack puts both case-file packs into
// their starting folders with their registers, leaves the two live files out, writes the Discord export's deletion
// flag and picks up where it stopped on a second run; the two demo questions keep their type words, the keyword
// search finds the passages ANSWERS.md names, and "the incident" points the question's path at the Incident.
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, engineGet } from '../src/data/client.ts';
import { fetchRows } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';
import { getFolders } from '../src/data/intake.ts';
import { PACKS, importPack } from './import-pack.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK_PORT = 8810;
const SEED_PORT = 8811;
const throwaway = (name) => ({ db: `data/${name}.sqlite`, files: `data/${name}-files` });
const PACK = throwaway('proof-pack');
const SEED = throwaway('proof-pack-seed');
const STEP6 = 'what connects Joaquin Dela Peña to the incident';
const STEP7 = 'which hauler serves more than one LGU and what did the inspections say';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const envOf = (port, t) => ({ ...process.env, BARGHEST_DB: t.db, BARGHEST_ENGINE_PORT: String(port), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: t.files });

async function up(base) {
  try {
    return (await fetch(`${base}/barghest/health`)).ok;
  } catch {
    return false;
  }
}
async function startEngine(port, t) {
  const base = `http://localhost:${port}`;
  if (await up(base)) throw new Error(`something already answers on ${base}`);
  const child = spawn('node', ['engine/server.mjs'], { cwd: root, env: envOf(port, t), stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 100; i++) {
    if (await up(base)) return child;
    await sleep(100);
  }
  child.kill();
  throw new Error('engine did not come up on ' + base);
}
async function stopEngine(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));
}
function run(script, env) {
  return new Promise((res, rej) => {
    const c = spawn('node', [script], { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
    c.once('exit', (code) => (code === 0 ? res() : rej(new Error(`${script} exited ${code}`))));
  });
}
const clean = (t) => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, t.db + suffix), { force: true });
  rmSync(join(root, t.files), { recursive: true, force: true });
};
const leftovers = (t) => ['', '-wal', '-shm'].map((s) => t.db + s).concat(t.files).filter((p) => existsSync(join(root, p)));

async function rowsOf(dc, type, steps) {
  let exp = startExploration(type, 200);
  for (const s of steps) exp = withStep(exp, s);
  const rows = [];
  let token;
  do {
    const page = await fetchRows(dc, exp, token);
    rows.push(...page.rows);
    token = page.nextPageToken;
  } while (token);
  return rows;
}
const eq = (property, value) => ({ filter: { property, op: 'eq', value } });

async function packs() {
  const base = `http://localhost:${PACK_PORT}`;
  const quiet = () => {};
  const engine = await startEngine(PACK_PORT, PACK);
  try {
    const dc = await connect(base);
    const titleOf = new Map();
    for (const investigation of Object.keys(PACKS)) {
      const r = await importPack({ investigation, skipLive: true, engine: base, log: quiet });
      const live = PACKS[investigation].flatMap((f) => f.files.filter((x) => x[2]).map((x) => x[0]));
      const all = PACKS[investigation].flatMap((f) => f.files);
      check(`${investigation}: every folder at the top level`, PACKS[investigation].every((f) => r.folders[f.folder]), Object.keys(r.folders).join(', '));
      check(`${investigation}: every file but the live one imported, none read with the model off`, r.imported.length === all.length - live.length && r.read.length === 0 && !r.modelOn, `${r.imported.length} imported, ${r.read.length} read`);
      check(`${investigation}: the live file left out`, r.skipped.length === 1 && r.skipped[0].name === live[0] && r.skipped[0].why === 'live', r.skipped.map((s) => s.name).join(', '));

      const docs = await rowsOf(dc, 'Document', [eq('scenario', investigation)]);
      for (const d of docs) titleOf.set(d.pk, d.properties.title);
      const wrong = [];
      for (const { folder, files } of PACKS[investigation]) {
        for (const [name, register, isLive] of files) {
          const d = docs.find((x) => x.properties.title === name);
          if (isLive) {
            if (d) wrong.push(`${name} is there`);
            continue;
          }
          if (!d) wrong.push(`${name} missing`);
          else if (d.properties.folderId !== r.folders[folder] || d.properties.register !== register || d.properties.system !== register) wrong.push(`${name} in ${d.properties.folderId} as ${d.properties.register}`);
        }
      }
      check(`${investigation}: each file in its folder with its register`, wrong.length === 0 && docs.length === all.length - live.length, wrong.join('; ') || `${docs.length} files`);

      const counts = await getFolders(dc, investigation);
      const liveFolder = PACKS[investigation].find((f) => f.files.some((x) => x[2]));
      const liveCount = counts.folders.find((f) => f.id === r.folders[liveFolder.folder])?.files;
      check(`${investigation}: ${liveFolder.folder} holds everything but the live file`, liveCount === liveFolder.files.length - 1 && counts.topLevelFiles === 0, `${liveCount} files there, ${counts.topLevelFiles} at the top level`);

      const again = await importPack({ investigation, skipLive: true, engine: base, log: quiet });
      check(`${investigation}: a second run imports nothing and keeps the folders`, again.imported.length === 0 && JSON.stringify(again.folders) === JSON.stringify(r.folders), `${again.imported.length} imported, ${again.skipped.length} left out`);
    }

    const discord = await rowsOf(dc, 'Document', [eq('title', 'discord-export.json')]);
    const flags = await rowsOf(dc, 'Relationship', [eq('method', 'system')]);
    check('the Discord export wrote its one deletion flag, and nothing else wrote one', flags.length === 1 && discord.length === 1 && flags[0].properties.kind === 'deleted_messages_of', flags.map((f) => f.properties.label).join('; '));

    const files = (s) => [...new Set(s.passages.map((p) => titleOf.get(p.documentId)))];
    const s7 = await engineGet(dc, '/barghest/search', { q: STEP7, investigation: 'solid-waste', k: '10' });
    check('step 7 keeps hauler, LGU and inspections as terms', ['hauler', 'lgu', 'inspections'].every((t) => s7.terms.includes(t)), s7.terms.join(', '));
    const want7 = ['swm-plan-saneladio.pdf', 'swm-plan-tumanaw.pdf', 'emb-inspection-letters.txt'];
    check('step 7 keyword search, ten passages as the Assistant reads, finds both plans that name the hauler and the inspection letters', want7.every((f) => files(s7).includes(f)), files(s7).join(', '));

    const s6 = await engineGet(dc, '/barghest/search', { q: STEP6, investigation: 'school-incident', k: '10' });
    check('step 6 keeps the name and incident as terms', ['joaquin', 'dela', 'pena', 'incident'].every((t) => s6.terms.includes(t)), s6.terms.join(', '));
    const want6 = ['irf-blotter.txt', 'spot-report.pdf'];
    check('step 6 keyword search, ten passages, finds the blotter (took the pistol) and the spot report (the incident)', want6.every((f) => files(s6).includes(f)), files(s6).join(', '));
  } finally {
    await stopEngine(engine);
  }
}

async function seeded() {
  const base = `http://localhost:${SEED_PORT}`;
  await run('engine/dev-seed.mjs', envOf(SEED_PORT, SEED));
  const engine = await startEngine(SEED_PORT, SEED);
  try {
    const res = await fetch(`${base}/barghest/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: STEP6, investigation: 'school-incident' }) });
    const a = await res.json();
    const person = a.objects.find((o) => o.type === 'Person' && !o.byType);
    const incident = a.objects.find((o) => o.type === 'Incident' && o.byType);
    check('step 6 on the seed: the subject by name and the Incident by the word "incident"', person?.pk === 'P-001' && incident?.pk === 'I-001', a.objects.map((o) => `${o.type}:${o.pk}${o.byType ? ' (type)' : ''}`).join(', '));
    check('step 6 on the seed: the path runs from the subject to the Incident, model off and still refused', a.relationships.length > 0 && a.refused === true && a.model === null, `${a.relationships.length} relationships on the path: ${a.relationships.map((r) => r.label).join('; ')}`);
  } finally {
    await stopEngine(engine);
  }
}

async function main() {
  clean(PACK);
  clean(SEED);
  try {
    await packs();
    await seeded();
  } finally {
    clean(PACK);
    clean(SEED);
  }
  const left = [...leftovers(PACK), ...leftovers(SEED)];
  check('nothing left behind', left.length === 0, left.join(', ') || 'throwaway databases and files removed');
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} of ${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  clean(PACK);
  clean(SEED);
  process.exit(1);
});
