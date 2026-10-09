// System flags proof (node engine/proof-flags.mjs, engine-api.md 2.9): the school incident's Discord export goes
// through POST /barghest/import on a throwaway database with the model off. The engine writes the bulk deletion
// (the fourteen messages) as a Relationship with method "system": observedAt, a plain label, passageIds on the
// export's passage, recordIds on its row, DigitalAccount ends on the same passage. The Timeline tags it system,
// the audit log holds the flag, a second import writes nothing twice, and deleting the file takes it all away.
// Exit 1 on any failure. About five seconds.
import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, engineGet } from '../src/data/client.ts';
import { fetchRows, getObjectView } from '../src/data/reads.ts';
import { startExploration } from '../src/data/exploration.ts';
import { deleteDocument, getDocumentView, importFile } from '../src/data/intake.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8797;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-flags.sqlite';
const FILES = 'data/proof-flags-files';
const INV = 'school-incident';
const EXPORT = 'data/school-incident/sources/discord-export.json';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: FILES };

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
const clean = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
  rmSync(join(root, FILES), { recursive: true, force: true });
};
const rowsOf = (dc, type) => fetchRows(dc, startExploration(type, 200)).then((p) => p.rows);
const systemRows = (view) => view.passages.flatMap((p) => p.relationships.filter((r) => r.method === 'system').map((r) => ({ ...r, passagePk: p.pk, passageText: p.text })));

async function main() {
  clean();
  const engine = await startEngine();
  try {
    const dc = await connect(BASE);
    const bytes = readFileSync(join(root, EXPORT));
    const file = new File([bytes], 'discord-export.json', { type: 'application/json' });

    // 1. Import with the model off: one flag.
    const imported = await importFile(dc, { file, investigation: INV, system: 'Discord', extract: false });
    check('import answers flags: 1 for the Discord export', imported.flags === 1, `flags=${imported.flags}, passages=${imported.passages}, records=${imported.records}`);

    // 2. The file view carries exactly one system row, on the passage that states the deletion.
    const view = await getDocumentView(dc, imported.documentId);
    const sys = systemRows(view);
    check('one relationship with method system in the file view', sys.length === 1, `${sys.length}`);
    const flag = sys[0] ?? {};
    check('its passage is the one holding MESSAGE_BULK_DELETE', Boolean(flag.passageText && flag.passageText.includes('MESSAGE_BULK_DELETE')), flag.passagePk ?? 'none');
    check('the label says what was removed and when', /^14 messages by hollow\.ix deleted by Vesper_Krael, 14 Sep 2026 09:24 to 09:31$/.test(flag.label ?? ''), flag.label ?? 'none');
    check('from Vesper_Krael to hollow.ix, both digital accounts', flag.from?.type === 'DigitalAccount' && flag.from?.title === 'Vesper_Krael' && flag.to?.type === 'DigitalAccount' && flag.to?.title === 'hollow.ix', `${flag.from?.title} -> ${flag.to?.title}`);
    check('kind deleted_messages_of, status observed, confidence 1', flag.kind === 'deleted_messages_of' && flag.status === 'observed' && flag.confidence === 1, `${flag.kind} ${flag.status} ${flag.confidence}`);

    // 3. The object view: observedAt at the window start, passageIds and recordIds on the export.
    const obj = await getObjectView(dc, 'Relationship', flag.pk);
    const prop = (n) => obj.properties.find((p) => p.apiName === n)?.value;
    check('observedAt is the window start, 14 Sep 2026 09:24 Manila', prop('observedAt') === '2026-09-14T01:24:00.000Z', String(prop('observedAt')));
    check('passageIds names the export passage, recordIds its row', Array.isArray(prop('passageIds')) && prop('passageIds')[0] === flag.passagePk && Array.isArray(prop('recordIds')) && String(prop('recordIds')[0]).startsWith(`${imported.documentId}-r`), `${prop('passageIds')} / ${prop('recordIds')}`);
    check('the object view hands the passage as evidence', obj.passages.length === 1 && obj.passages[0].pk === flag.passagePk, `${obj.passages.length}`);

    // 4. The Timeline around the deleting account tags the event system, with the passage for its Evidence button.
    const tl = await engineGet(dc, '/barghest/timeline', { objectId: `DigitalAccount:${flag.from.pk}`, hops: '1' });
    const ev = tl.events.find((e) => e.id === `Relationship:${flag.pk}`);
    check('timeline event tagged system with the passage id', Boolean(ev) && ev.tag === 'system' && ev.at === '2026-09-14T01:24:00.000Z' && ev.passageIds[0] === flag.passagePk, ev ? `${ev.tag} ${ev.at}` : 'no event');

    // 5. The audit log holds the flag, by the engine, naming the relationship and the document.
    const audit = await engineGet(dc, '/barghest/audit', { objectId: `Relationship:${flag.pk}` });
    const row = audit.find((a) => a.action === 'flag');
    check('audit row: flag by engine, applied, naming the document', Boolean(row) && row.actor === 'engine' && row.outcome === 'applied' && row.objectIds.includes(`Document:${imported.documentId}`) && row.params.label === flag.label, row ? `${row.actor} ${row.outcome}` : 'no row');

    // 6. Same file again: the same flag once.
    const again = await importFile(dc, { file, investigation: INV, system: 'Discord', extract: false });
    const rels = await rowsOf(dc, 'Relationship');
    const accounts = await rowsOf(dc, 'DigitalAccount');
    check('a second import writes nothing twice: one system row, two accounts', again.documentId === imported.documentId && rels.filter((r) => r.properties.method === 'system').length === 1 && accounts.length === 2, `${rels.length} relationships, ${accounts.length} accounts`);

    // 7. Delete the file: the flag and its ends go with it.
    const gone = await deleteDocument(dc, imported.documentId);
    const after = { rels: await rowsOf(dc, 'Relationship'), accounts: await rowsOf(dc, 'DigitalAccount') };
    check('delete-document removes the flag and both accounts', gone.removed.relationships === 1 && after.rels.length === 0 && after.accounts.length === 0, `relationships=${after.rels.length} accounts=${after.accounts.length}`);
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
  clean();
  process.exit(1);
});
