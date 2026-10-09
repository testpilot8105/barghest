// Import a demo investigation's case files (pnpm import:pack <investigation> [--skip-live] [--engine <url>]
// [--no-extract]) over the engine's HTTP routes: the starting folders, then every file in data/<investigation>/sources/
// into its folder with its register. Files are stored without the model and then read one at a time, each waiting for
// the last, so the model never has more than one file in hand and a request never queues behind twenty others. With
// the model off, or with --no-extract, the files are only stored. A file the investigation already holds (same
// original name) is skipped, so a second run picks up where the first stopped; that is also how a live file is
// rehearsed after a --skip-live run: run again without the flag and only the live file goes in.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '../src/data/client.ts';
import { fetchRows } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';
import { createFolder, extractAgain, getDocumentView, getFolders, getHealth, getInvestigations, importFile } from '../src/data/intake.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Folder, files and register per investigation. `live` marks the file imported on stage, left out by --skip-live. */
export const PACKS = {
  'school-incident': [
    { folder: 'Police', files: [['spot-report.pdf', 'PNP Spot Report'], ['irf-blotter.txt', 'PNP e-Blotter'], ['pnp-par.txt', 'Property Acknowledgment Receipt'], ['feo-firearm-records.csv', 'PNP FEO records']] },
    { folder: 'Forensics', files: [['firearms-identification-report.pdf', 'PNP Forensic Group', 'live']] },
    { folder: 'School', files: [['deped-lis-export.csv', 'DepEd LIS'], ['guidance-intake-sheets.txt', 'Anti-Bullying Intake Sheet']] },
    { folder: 'Digital', files: [['discord-export.json', 'Discord export'], ['messenger-thread.txt', 'Messenger export'], ['roblox-chat.txt', 'Roblox export'], ['tiktok-takedown.csv', 'TikTok takedown'], ['livestream-metadata.json', 'Livestream record']] },
    { folder: 'Intelligence', files: [['acg-intel-report.pdf', 'PNP-ACG'], ['cicc-advisory.txt', 'CICC']] },
  ],
  'solid-waste': [
    { folder: 'LGU plans', files: [['swm-plan-saneladio.pdf', 'SWM Plan'], ['swm-plan-tumanaw.pdf', 'SWM Plan'], ['swm-plan-dalumat.pdf', 'SWM Plan']] },
    { folder: 'Procurement', files: [['hauling-contracts.pdf', 'Hauling contract', 'live'], ['philgeps-awards.csv', 'PhilGEPS']] },
    { folder: 'Operations', files: [['truck-trip-logs.csv', 'Trip logs'], ['mrf-quarterly-reports.csv', 'MRF report'], ['complaints-8888.csv', '8888 hotline']] },
    { folder: 'Regulators', files: [['emb-inspection-letters.txt', 'DENR-EMB'], ['denr-landfill-permit.txt', 'DENR ECC']] },
    { folder: 'Audit', files: [['coa-audit-observations.pdf', 'COA AOM']] },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const seconds = (ms) => `${Math.round(ms / 1000)} s`;

function parseArgs(argv) {
  const args = { investigation: '', skipLive: false, extract: true, engine: process.env.BARGHEST_ENGINE_URL ?? 'http://localhost:8787' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skip-live') args.skipLive = true;
    else if (a === '--no-extract') args.extract = false;
    else if (a === '--engine') args.engine = argv[++i] ?? '';
    else if (!a.startsWith('--') && !args.investigation) args.investigation = a;
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

/** The original file names the investigation already holds. */
async function heldTitles(dc, investigation) {
  const titles = new Set();
  const exp = withStep(startExploration('Document', 200), { filter: { property: 'scenario', op: 'eq', value: investigation } });
  let token;
  do {
    const page = await fetchRows(dc, exp, token);
    for (const row of page.rows) titles.add(String(row.properties.title ?? ''));
    token = page.nextPageToken;
  } while (token);
  return titles;
}

/** Wait until the model has finished one file, then say how it went. */
async function waitForExtraction(dc, documentId) {
  for (;;) {
    const health = await getHealth(dc);
    if (!health.extracting.includes(documentId)) break;
    await sleep(2000);
  }
  return (await getDocumentView(dc, documentId)).document.status;
}

export async function importPack({ investigation, skipLive = false, extract = true, engine = 'http://localhost:8787', log = console.log }) {
  const pack = PACKS[investigation];
  if (!pack) throw new Error(`no pack for ${investigation}; one of ${Object.keys(PACKS).join(', ')}`);
  const dc = await connect(engine);
  const { investigations } = await getInvestigations(dc);
  const inv = investigations.find((i) => i.id === investigation);
  if (!inv) throw new Error(`the engine at ${engine} holds no investigation ${investigation}`);
  const health = await getHealth(dc);
  const modelOn = !Array.isArray(health.models);
  const reading = extract && modelOn;
  log(`${inv.name}: ${engine}, model ${modelOn ? 'on' : 'off'}${reading ? '' : ', files stored without reading'}`);

  // 1. The starting folders, all of them, the live file's too, reusing one of the same name at the top level.
  const existing = (await getFolders(dc, investigation)).folders.filter((f) => !f.parentId);
  const folderIds = {};
  for (const { folder } of pack) {
    const found = existing.find((f) => f.name.toLowerCase() === folder.toLowerCase());
    folderIds[folder] = found ? found.id : (await createFolder(dc, { investigation, name: folder })).id;
    log(`folder ${folder}${found ? ' (already there)' : ''}`);
  }

  // 2. Every file into its folder with its register, stored without the model.
  const held = await heldTitles(dc, investigation);
  const imported = [];
  const skipped = [];
  for (const { folder, files } of pack) {
    for (const [name, register, live] of files) {
      if (live && skipLive) {
        skipped.push({ name, why: 'live' });
        continue;
      }
      if (held.has(name)) {
        skipped.push({ name, why: 'already imported' });
        continue;
      }
      const buffer = readFileSync(join(root, 'data', investigation, 'sources', name));
      const file = new File([buffer], name);
      const r = await importFile(dc, { file, investigation, system: register, folderId: folderIds[folder], extract: false });
      imported.push({ name, folder, register, documentId: r.documentId, passages: r.passages, status: r.status, flags: r.flags });
      log(`imported ${name} into ${folder} as ${register}: ${r.passages} passages${r.flags ? `, ${r.flags} system flag` : ''}${r.status !== 'imported' ? ` (${r.status})` : ''}`);
    }
  }
  for (const s of skipped) log(`left out ${s.name} (${s.why})`);

  // 3. The model reads them one at a time.
  const read = [];
  if (reading) {
    const todo = imported.filter((f) => f.status === 'imported');
    const total = todo.reduce((n, f) => n + f.passages, 0);
    log(`reading ${todo.length} files, ${total} passages`);
    for (const [i, f] of todo.entries()) {
      const started = Date.now();
      await extractAgain(dc, f.documentId);
      const status = await waitForExtraction(dc, f.documentId);
      const ms = Date.now() - started;
      read.push({ ...f, readStatus: status, ms });
      log(`read ${i + 1} of ${todo.length}: ${f.name}, ${f.passages} passages, ${seconds(ms)}, ${status}`);
    }
  }
  return { investigation, name: inv.name, modelOn, folders: folderIds, imported, skipped, read };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.investigation) {
    console.error('usage: pnpm import:pack <investigation> [--skip-live] [--engine <url>] [--no-extract]');
    process.exit(2);
  }
  const started = Date.now();
  importPack(args)
    .then((r) => {
      console.log(`done: ${r.imported.length} imported, ${r.skipped.length} left out, ${r.read.length} read, ${seconds(Date.now() - started)}`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(`import:pack failed: ${e?.message ?? e}`);
      process.exit(1);
    });
}
