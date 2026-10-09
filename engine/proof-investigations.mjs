// Step 2 proof (pnpm proof:investigations): investigations as store records built from blocks, on a throwaway
// database with the model off. The two demo templates still produce byte-identical extraction schemas and prompts
// (engine/extract/snapshots/), no letter id is left in the app, and the `others` catch-all lands as a Thing with a
// related_to Relationship. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, engineGet } from '../src/data/client.ts';
import { fetchRows } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';
import { createInvestigation, getInvestigations, importFile } from '../src/data/intake.ts';
import { templateOf } from './extract/blocks.mjs';
import { jsonSchemaOf, schemaFor } from './extract/schemas.mjs';
import { extractionPrompt, SYSTEM_EXTRACT } from './extract/prompts.mjs';
import { toObjects } from './extract/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8790;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-investigations.sqlite';
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
const cleanDb = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
};
const refused = (promise) => promise.then(() => null, (e) => e);

/** Every line of the app's own text files that still names an investigation by letter. */
function letterOffenders() {
  const patterns = [/scenario-[ab]\b/, /Scenario [AB]\b/, /scenario(=|: ?'|": ?"|\s*[!=]==\s*')[ab]\b/, /ENTITY_TYPES_[AB]\b/, /scenario[AB]\b/];
  const skip = new Set(['node_modules', 'sdk', 'dist', 'dist-shots', '.git', 'Session Logs']);
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(mjs|ts|tsx|mts|md|json|css|html|txt|csv)$/.test(name)) {
        readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (patterns.some((re) => re.test(line))) offenders.push(`${relative(root, p)}:${i + 1}`);
        });
      }
    }
  };
  walk(root);
  return offenders;
}

async function main() {
  cleanDb();
  let engine = await startEngine();
  try {
    const dc = await connect(BASE);

    // 1, 2. The demo investigations exist from the first start; templates and blocks are listed
    const list = await getInvestigations(dc);
    const ids = list.investigations.map((i) => i.id);
    const school = list.investigations.find((i) => i.id === 'school-incident');
    const waste = list.investigations.find((i) => i.id === 'solid-waste');
    check("1 the two demo investigations exist from the first start, with their templates' blocks and no documents", same(ids, ['school-incident', 'solid-waste']) && school?.name === 'School incident' && same(school?.blocks, templateOf('school-incident').blocks) && waste?.name === 'Solid waste' && same(waste?.blocks, templateOf('solid-waste').blocks) && school?.documents === 0, ids.join(', '));
    check('2 GET investigations lists three templates and nineteen blocks, each with a label and one type; others is Thing', list.templates.length === 3 && same(list.templates.map((t) => t.id), ['school-incident', 'solid-waste', 'general']) && list.blocks.length === 19 && list.blocks.every((b) => b.id && b.label && b.types.length === 1) && list.blocks.find((b) => b.id === 'others')?.types[0] === 'Thing', `${list.templates.length} templates, ${list.blocks.length} blocks`);

    // 3, 4. Create one from general; the audit row names it
    const created = await createInvestigation(dc, { name: 'Port survey: Dalumat wharf' });
    check('3 POST investigations from general: a slug id with a hash, the general blocks, zero documents', /^port-survey-dalumat-wharf-[0-9a-f]{6}$/.test(created.id) && created.name === 'Port survey: Dalumat wharf' && created.template === 'general' && same(created.blocks, templateOf('general').blocks) && created.documents === 0, created.id);
    const audit = await engineGet(dc, '/barghest/audit', { objectId: `Investigation:${created.id}` });
    check('4 the audit row names the new investigation, by the analyst', audit.length === 1 && audit[0].action === 'createInvestigation' && audit[0].actor === 'analyst' && audit[0].params.name === created.name, `${audit.length} row(s)`);

    // 5. Refusals
    const empty = await refused(createInvestigation(dc, { name: '   ' }));
    const badBlock = await refused(createInvestigation(dc, { name: 'x', blocks: ['persons', 'ships'] }));
    const badTemplate = await refused(createInvestigation(dc, { name: 'x', template: 'nope' }));
    check('5 an empty name, an unknown block and an unknown template are refused with 400 and a reason', empty?.status === 400 && badBlock?.status === 400 && /ships/.test(badBlock?.message ?? '') && badTemplate?.status === 400 && /nope/.test(badTemplate?.message ?? ''), [empty?.message, badBlock?.message, badTemplate?.message].join(' | '));

    // 6. Blocks win over the template, in canonical order; the same name twice gives two ids
    const custom = await createInvestigation(dc, { name: 'Port survey: Dalumat wharf', template: 'school-incident', blocks: ['others', 'persons', 'vehicles'] });
    check('6 blocks win over the template and come back in canonical order; the same name gets a different id', same(custom.blocks, ['persons', 'vehicles', 'others']) && custom.template === 'school-incident' && custom.id !== created.id, `${custom.id}: ${custom.blocks.join(', ')}`);

    // 7. A TXT imported into the created investigation carries its id
    const file = new File(['The MV Sierra Madre docked at Dalumat wharf on 3 March. Ana Reyes paid the port fee.'], 'wharf-log.txt', { type: 'text/plain' });
    const imported = await importFile(dc, { file, investigation: created.id, system: 'Port log', extract: false });
    const docs = await fetchRows(dc, withStep(startExploration('Document'), { filter: { property: 'scenario', op: 'eq', value: created.id } }));
    const after = await getInvestigations(dc);
    const count = after.investigations.find((i) => i.id === created.id)?.documents;
    check('7 a TXT imported into it carries the investigation id and counts as its one document', imported.extraction === 'off' && same(docs.rows.map((r) => r.pk), [imported.documentId]) && count === 1, `${docs.rows.length} document(s), count ${count}`);

    // 8. Unknown ids are refused everywhere; scenario= still works as an alias
    const unknownImport = await refused(importFile(dc, { file, investigation: 'no-such-investigation', extract: false }));
    const unknownResolve = await fetch(`${BASE}/barghest/resolve?investigation=no-such-investigation`, { method: 'POST' });
    const unknownSearch = await fetch(`${BASE}/barghest/search?q=wharf&investigation=no-such-investigation`);
    const aliasSearch = await fetch(`${BASE}/barghest/search?q=wharf&scenario=${created.id}`);
    check('8 an unknown investigation is refused (400) on import, resolve and search; scenario= is read as an alias', unknownImport?.status === 400 && unknownResolve.status === 400 && unknownSearch.status === 400 && aliasSearch.ok, `${unknownImport?.status} ${unknownResolve.status} ${unknownSearch.status}, alias ${aliasSearch.status}`);

    // 9, 10. The schema follows the blocks
    const js = jsonSchemaOf(schemaFor(created.blocks));
    const keys = Object.keys(js.properties);
    const rel = js.properties.relationships.items.properties;
    check("9 the general schema holds exactly its blocks plus relationships; the types are the blocks' types; related_to and label are in", same(keys, [...created.blocks, 'relationships']) && same(rel.fromType.enum, ['Person', 'Organization', 'Location', 'Event', 'Thing']) && rel.kind.enum.includes('related_to') && 'label' in rel, keys.join(', '));
    const noOthers = jsonSchemaOf(schemaFor(['vehicles', 'persons']));
    const relNo = noOthers.properties.relationships.items.properties;
    check('10 without the others block there is no related_to kind and no label, and blocks sort into canonical order', !relNo.kind.enum.includes('related_to') && !('label' in relNo) && same(Object.keys(noOthers.properties), ['persons', 'vehicles', 'relationships']), Object.keys(noOthers.properties).join(', '));

    // 11. The two demo templates match their snapshots byte for byte
    const passage = { index: 0, text: '<<<SNAPSHOT PASSAGE>>>' };
    const document = { title: 'snapshot', format: 'txt', system: 'snapshot register' };
    for (const id of ['school-incident', 'solid-waste']) {
      const blocks = list.investigations.find((i) => i.id === id).blocks;
      const schemaNow = JSON.stringify(jsonSchemaOf(schemaFor(blocks)), null, 2) + '\n';
      const schemaWas = readFileSync(join(root, 'engine', 'extract', 'snapshots', `${id}.schema.json`), 'utf8');
      const promptNow = SYSTEM_EXTRACT + '\n=====\n' + extractionPrompt({ blocks, passage, document });
      const promptWas = readFileSync(join(root, 'engine', 'extract', 'snapshots', `${id}.prompt.txt`), 'utf8');
      check(`11 ${id}: the stored record's blocks give the snapshot schema and prompt byte for byte`, schemaNow === schemaWas && promptNow === promptWas, `schema ${schemaNow.length} vs ${schemaWas.length} bytes, prompt ${promptNow.length} vs ${promptWas.length} bytes`);
    }

    // 12. No letters left
    const offenders = letterOffenders();
    check('12 no letter investigation id is left in the app (outside node_modules, sdk, dist and the Session Logs)', offenders.length === 0, offenders.slice(0, 8).join(', ') || 'clean');

    // 13. Mapper dry-run: an others item and a related_to link land as a Thing and a Relationship
    const reply = {
      persons: [{ name: 'Ana Reyes' }],
      organizations: [],
      locations: [],
      events: [],
      others: [{ name: 'MV Sierra Madre', kind: 'ship' }],
      relationships: [{ fromName: 'Ana Reyes', fromType: 'Person', toName: 'MV Sierra Madre', toType: 'Thing', kind: 'related_to', label: 'boarded', confidence: 0.8 }],
    };
    const valid = schemaFor(created.blocks).safeParse(reply);
    const out = toObjects(meta, { scenario: created.id, passageId: 'PS-dry', data: valid.success ? valid.data : reply });
    const thing = out.objects.find((o) => o.__apiName === 'Thing');
    const relObj = out.objects.find((o) => o.__apiName === 'Relationship');
    check('13 a hand-written reply with an others item and a related_to link validates and lands as a Thing and a Relationship with the words kept', valid.success && thing?.name === 'MV Sierra Madre' && thing?.kind === 'ship' && thing?.scenario === created.id && relObj?.kind === 'related_to' && relObj?.kindLabel === 'boarded' && relObj?.label === 'Ana Reyes boarded MV Sierra Madre' && relObj?.toThingId === thing?.__primaryKey && !!relObj?.fromPersonId, out.objects.map((o) => `${o.__apiName} ${o.__title}`).join(', '));

    // 14. The ontology carries the new names
    const thingDef = dc.catalog.types.Thing;
    const scen = dc.catalog.types.Person.properties.find((p) => p.apiName === 'scenario');
    const kindLabel = dc.catalog.types.Relationship.properties.find((p) => p.apiName === 'kindLabel');
    check('14 the catalog lists Thing as the entity "Other thing", scenario displays as "Investigation", Relationship has kindLabel', thingDef?.displayName === 'Other thing' && thingDef?.entity === true && thingDef?.titleProperty === 'name' && scen?.displayName === 'Investigation' && kindLabel?.displayName === 'Kind, as written', `${thingDef?.displayName}; ${scen?.displayName}; ${kindLabel?.displayName}`);

    // 15. Restart: the records persist and the demo two are not created twice
    await stopEngine(engine);
    engine = await startEngine();
    const dc2 = await connect(BASE);
    const again = await getInvestigations(dc2);
    check('15 after a restart the created investigations are still there, with their documents, and the demo two are not duplicated', again.investigations.length === 4 && again.investigations.filter((i) => i.id === 'school-incident').length === 1 && again.investigations.find((i) => i.id === created.id)?.documents === 1, again.investigations.map((i) => i.id).join(', '));
  } catch (e) {
    check('no exception', false, e?.message ?? String(e));
    console.error(e);
  } finally {
    await stopEngine(engine);
    cleanDb();
  }
}

await main();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:investigations: FAIL (${failed.length} of ${results.length})` : `proof:investigations: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
