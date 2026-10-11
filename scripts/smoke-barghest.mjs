// BARGHEST smoke: serve dist/ and prove the shell, not describe it. At 1440 x 900 and again at 1920 x 1080: bp6-dark
// on body; the owner's palette (Graphite: chrome dark gray 1, main dark gray 2; each rail icon in its own colour, kept
// when open, on one grey highlight for every view); D-DIN loaded and used only on big or all-caps text, Source Sans 3
// on everything else; nothing under 14px; the owner's Figma version (the dog and BARGHEST in D-DIN then search
// across the app bar, the toggle on top of the rail, 4px between rail icons); rail labels not repainted link-blue;
// the rail at its collapsed width with a tooltip, then expanded; the URL drives the view (click, back); the document
// never scrolls; zero console errors. Then the Object Explorer on the running engine's data: types with their counts, a
// type started, a value filter added and removed, Back and Forward, Search Around to digital accounts and their
// platforms (demo step 3), View results into Browser's list and back (the profile is smoke-profile's), a broken link; all-caps headings in D-DIN Bold.
// Then Data Sources (the strip naming the model's state, the files or the empty state, the model log) and Files (the
// investigations by name, never an id; the files or the empty state; the Investigation menu and New investigation
// dialog, opened and closed, nothing created; with the model off, a file imported, opened by double-click, deleted
// through the confirm, and checked gone from the engine). Screenshots to dist-shots/. Exit 1 on any failure. Needs the engine on
// 8787 (BARGHEST_OLLAMA=off pnpm dev:engine), or on BARGHEST_ENGINE_PORT.
// Run: pnpm smoke   --geometry prints the measured boxes as well.
import { chromium } from 'playwright';
import { createServer, request } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(app, 'dist');
const shots = join(app, 'dist-shots');
const showGeometry = process.argv.includes('--geometry');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('smoke: no dist/index.html; run pnpm build first');
  process.exit(1);
}

// The engine, reached the way Vite's proxy reaches it: /barghest/ and /api/ go to 8787, everything else is dist/.
const ENGINE = { host: '127.0.0.1', port: Number(process.env.BARGHEST_ENGINE_PORT ?? 8787) };
const health = await fetch(`http://${ENGINE.host}:${ENGINE.port}/barghest/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error(`smoke: the engine is not answering on ${ENGINE.port}; start it with BARGHEST_OLLAMA=off pnpm dev:engine`);
  process.exit(1);
}
const seeded = health.ontology.objects;
// The investigations: a bare / opens the first one the engine lists, and screens name it, never its id.
const listed = await fetch(`http://${ENGINE.host}:${ENGINE.port}/barghest/investigations`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
if (!listed?.investigations?.length) {
  console.error(`smoke: the engine on ${ENGINE.port} lists no investigations; it may predate them, so restart it`);
  process.exit(1);
}
const FIRST = listed.investigations[0];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.png': 'image/png' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/barghest/') || url.pathname.startsWith('/api/')) {
    const fwd = request({ ...ENGINE, path: req.url, method: req.method, headers: { ...req.headers, host: `${ENGINE.host}:${ENGINE.port}` } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    fwd.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(fwd);
    return;
  }
  let file = join(dist, decodeURIComponent(url.pathname));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// Blueprint v6's own values, read from its CSS, never remembered.
const DARK_GRAY_1 = 'rgb(28, 33, 39)';
const DARK_GRAY_2 = 'rgb(37, 42, 49)';
// The owner's icon colours, "Spectrum, vivid", in rail order.
const VIEW_FILLS = {
  Files: [245, 73, 139], // rose-4
  'Data Sources': [235, 104, 71], // vermilion-4
  'Object Explorer': [240, 183, 38], // gold-4
  Browser: [182, 217, 76], // lime-4
  Graph: [67, 191, 77], // forest-4
  Timeline: [19, 201, 186], // turquoise-4
  Assistant: [63, 166, 218], // cerulean-4
};
const LINK_BLUE = ['rgb(138, 187, 255)', 'rgb(76, 144, 240)', 'rgb(45, 114, 210)'];
const LABEL_FACE = 'D-DIN';
const BODY_FACE = 'Source Sans 3 Variable';

const browser = await chromium.launch({ channel: 'chromium', headless: true });
const t0 = Date.now();
const failures = [];
mkdirSync(shots, { recursive: true });

const decode = (u) => {
  const enc = new URL(u).searchParams.get('exploration');
  return enc ? JSON.parse(Buffer.from(enc, 'base64url').toString()) : null;
};

const smallText = (page) =>
  page.evaluate(() => {
    const small = [];
    for (const el of document.querySelectorAll('.app-shell *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && parseFloat(getComputedStyle(el).fontSize) < 14) small.push(`${el.className || el.tagName} ${getComputedStyle(el).fontSize}`);
    }
    return small;
  });

// The Object Explorer on the engine's data, then View results into Browser. Counts come from the engine's health, so
// the checks hold for any seed.
/** Where the first two rows and the first row's text sit, so a pick that moves anything shows up as a change. */
function rowsAt(page, rows, text) {
  return page.evaluate(([rows, text]) => {
    const [a, b] = document.querySelectorAll(rows);
    const t = a?.querySelector(text)?.getBoundingClientRect();
    const r = (n) => Math.round(n ?? -1);
    return `text ${r(t?.x)},${r(t?.y)} row ${r(a?.getBoundingClientRect().height)} next ${r(b?.getBoundingClientRect().y)}`;
  }, [rows, text]);
}

// Files and Data Sources on the engine's data, read-only: nothing is imported until delete exists (pass 2).
async function intakeFlow(page, tag, fail) {
  const capsOk = () =>
    page.evaluate((LABEL_FACE) => {
      const heads = [...document.querySelectorAll('.app-shell__main .caps-heading, .intake-table th')];
      return heads.length > 0 && heads.every((h) => { const s = getComputedStyle(h); return s.fontFamily.replace(/["']/g, '').startsWith(LABEL_FACE) && s.fontWeight === '700' && s.textTransform === 'uppercase'; });
    }, LABEL_FACE);
  const noScroll = () => page.evaluate(() => { const d = document.scrollingElement; return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth; });
  const small = () =>
    page.evaluate(() => [...document.querySelectorAll('.app-shell__main *')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14)
      .map((el) => `${el.className || el.tagName} ${getComputedStyle(el).fontSize}`));
  const files = listed.investigations[0].documents;

  await page.goto(origin + `/${FIRST.id}/sources`, { waitUntil: 'load' });
  await page.locator('.sources__strip').waitFor({ timeout: 10000 }).catch(() => fail('Data Sources: no strip'));
  await page.locator('.intake-table, .bp6-non-ideal-state').first().waitFor({ timeout: 10000 }).catch(() => fail('Data Sources: no list and no empty state'));
  const ds = await page.evaluate(() => ({
    strip: document.querySelector('.sources__strip')?.innerText ?? '',
    title: document.querySelector('.menubar__title')?.textContent ?? '',
    rows: document.querySelectorAll('.sources__body .intake-table:not(.log-table) tbody tr').length,
    empty: document.querySelector('.sources__body .bp6-non-ideal-state')?.innerText ?? '',
    log: document.querySelector('.sources__log')?.innerText ?? '',
  }));
  if (!/MODEL/.test(ds.strip) || !/\b(Off|Idle|Reading)\b/.test(ds.strip)) fail(`Data Sources strip says nothing about the model: "${ds.strip}"`);
  if (ds.title !== FIRST.name) fail(`Data Sources menu bar names "${ds.title}", want "${FIRST.name}"`);
  if (files ? ds.rows !== files : !ds.empty.includes('Drop files here or use Import files.')) fail(`Data Sources list: ${ds.rows} rows for ${files} files, empty state "${ds.empty}"`);
  if (!/MODEL LOG/i.test(ds.log)) fail('Data Sources: no model log');
  if (!(await capsOk())) fail('Data Sources: an all-caps heading is not D-DIN Bold');
  if (!(await noScroll())) fail('Data Sources: the document scrolls');
  const dsSmall = await small();
  if (dsSmall.length) fail(`Data Sources text under 14px: ${dsSmall.slice(0, 4).join('; ')}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, `sources-${tag}.png`) });

  await page.goto(origin + `/${FIRST.id}/files`, { waitUntil: 'load' });
  await page.locator('.files__tree').waitFor({ timeout: 10000 }).catch(() => fail('Files: no investigation list'));
  await page.locator('.files .intake-table, .files .bp6-non-ideal-state').first().waitFor({ timeout: 10000 }).catch(() => fail('Files: no list and no empty state'));
  const fl = await page.evaluate(() => ({
    tree: [...document.querySelectorAll('.files__tree .bp6-tree-root > .bp6-tree-node > .bp6-tree-node-content .bp6-tree-node-label')].map((n) => n.textContent),
    rows: document.querySelectorAll('.files .intake-table tbody tr').length,
    title: document.querySelector('.menubar__title')?.textContent ?? '',
  }));
  const names = listed.investigations.map((i) => i.name);
  if (fl.tree.join('|') !== names.join('|')) fail(`Files lists "${fl.tree.join(', ')}", want the names "${names.join(', ')}"`);
  if (fl.tree.some((t) => listed.investigations.some((i) => i.id === t && i.id !== i.name))) fail('Files shows an investigation id');
  // The top level lists its folders, then the files outside any folder.
  const engineFolders = () => fetch(`http://${ENGINE.host}:${ENGINE.port}/barghest/folders?investigation=${encodeURIComponent(FIRST.id)}`).then((r) => r.json());
  const top = await engineFolders();
  const topRows = top.folders.filter((f) => !f.parentId).length + top.topLevelFiles;
  if (topRows && fl.rows !== topRows) fail(`Files list: ${fl.rows} rows for ${topRows} folders and files at the top level`);
  if (fl.title !== FIRST.name) fail(`Files menu bar names "${fl.title}", want "${FIRST.name}"`);
  if (!(await capsOk())) fail('Files: an all-caps heading is not D-DIN Bold');
  if (!(await noScroll())) fail('Files: the document scrolls');
  const flSmall = await small();
  if (flSmall.length) fail(`Files text under 14px: ${flSmall.slice(0, 4).join('; ')}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, `files-${tag}.png`) });

  // The Investigation menu lists names; New investigation opens its dialog and closes without creating anything.
  await page.getByRole('button', { name: 'Investigation', exact: true }).click();
  const menu = await page.locator('.investigation-menu').innerText({ timeout: 3000 }).catch(() => '');
  if (!names.every((n) => menu.includes(n)) || !menu.includes('New investigation')) fail(`Investigation menu reads "${menu}"`);
  await page.getByRole('menuitem', { name: 'New investigation…' }).click();
  await page.locator('.new-investigation').waitFor({ timeout: 3000 }).catch(() => fail('New investigation dialog did not open'));
  const dialog = await page.locator('.new-investigation').innerText().catch(() => '');
  if (!/Name/.test(dialog) || /Start from|Solid waste|Haulers|What to look for/.test(dialog)) fail(`New investigation dialog reads "${dialog.slice(0, 160)}", want a name and nothing else`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, `files-${tag}-new-investigation.png`) });
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.locator('.new-investigation').waitFor({ state: 'detached', timeout: 3000 }).catch(() => fail('New investigation dialog did not close'));

  // Folders: New folder, rename it in place, delete it, then ask the engine that none of it is left.
  const folder = `smoke-${tag}-${Date.now()}`;
  const mine = async () => (await engineFolders()).folders.filter((f) => f.name.startsWith(folder)).map((f) => f.name);
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('Name').fill(folder);
  await page.getByRole('button', { name: 'Create' }).click();
  // The dialog hands focus back to New folder as it closes; rename only once it has gone, as a person would.
  await page.locator('.new-investigation').waitFor({ state: 'detached', timeout: 5000 }).catch(() => fail('New folder dialog did not close'));
  const folderRow = page.locator('.files .intake-table tbody tr', { hasText: folder });
  await folderRow.waitFor({ timeout: 5000 }).catch(() => fail('New folder never showed in the list'));
  await folderRow.getByRole('button', { name: `Actions for ${folder}` }).click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(`${folder} renamed`);
  await page.keyboard.press('Enter');
  const renamedRow = page.locator('.files .intake-table tbody tr', { hasText: `${folder} renamed` });
  await renamedRow.waitFor({ timeout: 5000 }).catch(() => fail('Rename did not change the folder in the list'));
  if ((await mine()).join() !== `${folder} renamed`) fail(`the engine names the folder "${(await mine()).join()}", want "${folder} renamed"`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, `files-${tag}-folder.png`) });
  await renamedRow.getByRole('button', { name: `Actions for ${folder} renamed` }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await renamedRow.waitFor({ state: 'detached', timeout: 5000 }).catch(() => fail('Delete left the folder in the list'));
  if ((await mine()).length) fail(`the engine still holds folder ${folder}`);

  // Import, open, delete, and nothing left behind. Only with the model off, so the smoke never makes the model read.
  if (health.ollama) return;
  const probe = `smoke-${tag}-${Date.now()}.txt`;
  const probePath = join(shots, probe);
  writeFileSync(probePath, 'SYNTHETIC: BARGHEST smoke file. Imported, opened and deleted by the smoke.\n');
  await page.locator('.files .intake-card__head input[type=file]').setInputFiles(probePath);
  rmSync(probePath);
  const row = page.locator('.files .intake-table tbody tr', { hasText: probe });
  await row.waitFor({ timeout: 10000 }).catch(() => fail(`imported ${probe} never showed in the list`));
  // Rename it in place and back; the engine says what it is called each time.
  const renameRow = async (from, to) => {
    await page.locator('.files .intake-table tbody tr', { hasText: from }).getByRole('button', { name: `Actions for ${from}` }).click();
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(to);
    await page.keyboard.press('Enter');
    await page.locator('.files .intake-table tbody tr', { hasText: to }).waitFor({ timeout: 5000 }).catch(() => fail(`Rename did not change ${from} to ${to} in the list`));
  };
  await renameRow(probe, probe.replace('.txt', '-renamed.txt'));
  await renameRow(probe.replace('.txt', '-renamed.txt'), probe);
  await row.dblclick();
  await page.locator('.file-view__name', { hasText: probe }).waitFor({ timeout: 5000 }).catch(() => fail('double-click did not open the file'));
  const documentId = new URL(page.url()).searchParams.get('document');
  if (!documentId) fail(`the open file is not in the address: ${page.url()}`);
  const shown = await fetch(`http://${ENGINE.host}:${ENGINE.port}/barghest/document?documentId=${encodeURIComponent(documentId ?? '')}`).then((r) => r.json()).catch(() => null);
  if (shown?.document?.name !== probe) fail(`after renaming back the engine calls the file "${shown?.document?.name}", want "${probe}"`);
  const passageCards = await page.locator('.file-pass').count();
  if (!passageCards) fail('the open file shows no passages');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, `files-${tag}-open.png`) });
  await page.getByRole('button', { name: 'Delete' }).click();
  const alertText = await page.locator('.intake-alert').innerText({ timeout: 3000 }).catch(() => '');
  if (!alertText.includes(`Delete ${probe}? What the model pulled from it goes too.`)) fail(`delete confirm reads "${alertText}"`);
  await page.locator('.intake-alert').getByRole('button', { name: 'Delete' }).click();
  await page.locator('.files .intake-table, .files .bp6-non-ideal-state').first().waitFor({ timeout: 10000 }).catch(() => fail('delete did not return to the list'));
  await page.waitForTimeout(500);
  if (await row.count()) fail(`${probe} is still listed after delete`);
  // A clean teardown is not a clean database: ask the engine for the file itself.
  const left = await fetch(`http://${ENGINE.host}:${ENGINE.port}/barghest/document?documentId=${encodeURIComponent(documentId ?? '')}`).then((r) => r.status);
  if (left !== 404) fail(`the engine still holds ${probe} (${documentId}): status ${left}`);
}

async function exploreFlow(page, tag, fail, width) {
  const want = (n) => `${Number(n).toLocaleString('en-US')} object${Number(n) === 1 ? '' : 's'}`;
  const header = () => page.locator('.explorer__title > span').last().innerText();
  const settle = (text) => page.locator('.explorer__title', { hasText: text }).waitFor({ timeout: 5000 }).catch(() => {});
  const expect = async (n, what) => {
    await settle(want(n));
    const got = await header();
    if (got !== want(n)) fail(`${what}: header reads "${got}", want "${want(n)}"`);
  };
  const add = () => page.getByRole('button', { name: 'Add to filter path' }).click();
  const total = Object.values(seeded).reduce((a, b) => a + b, 0);

  // Types: every object counted; People carries the engine's Person count.
  await expect(total, 'all objects');
  const people = page.getByRole('button', { name: /^People\b/ });
  if (!(await people.innerText()).includes(String(seeded.Person))) fail(`People row reads "${await people.innerText()}", want ${seeded.Person}`);
  const look = await page.evaluate(() => {
    const b = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; };
    return {
      card: b('.explorer__card'), dock: b('.dock'),
      caps: [...document.querySelectorAll('.caps-heading')].map((h) => { const s = getComputedStyle(h); return { family: s.fontFamily.replace(/["']/g, ''), weight: s.fontWeight, transform: s.textTransform }; }),
      bold: [...document.fonts].some((f) => f.status === 'loaded' && f.family.replace(/["']/g, '') === 'D-DIN' && f.weight === '700'),
    };
  });
  if (Math.round(look.dock.w) !== 260 || Math.round(look.dock.x + look.dock.w) !== width) fail(`dock ${JSON.stringify(look.dock)}, want 260 wide flush right`);
  if (Math.round(look.card.x) !== 56 || Math.round(look.card.y) !== 82 || Math.round(look.card.x + look.card.w) !== Math.round(look.dock.x) - 16) fail(`results card ${JSON.stringify(look.card)}, want a 16px gutter`);
  if (!look.caps.length || !look.bold || look.caps.some((c) => !c.family.startsWith(LABEL_FACE) || c.weight !== '700' || c.transform !== 'uppercase')) fail(`all-caps headings not D-DIN Bold: ${JSON.stringify(look)}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, `explorer-${tag}-types.png`) });

  // The menu bar and the dock name the set: everything, before a type is picked.
  const nameIs = async (want, what) => {
    const bar = (await page.locator('.menubar__title').innerText()).trim();
    const dock = (await page.locator('.dock__intro').innerText()).replace(/\s+/g, ' ').trim();
    if (bar !== want || !dock.startsWith(want)) fail(`${what}: menu bar "${bar}", dock "${dock}", want ${want}`);
  };
  await nameIs('All objects', 'no type picked');

  // Properties before a type lists every type's properties; one click on People's Role opens People with that chart.
  await page.getByRole('tab', { name: /Properties/ }).click();
  const role = page.getByRole('button', { name: /^Role\s*People/ });
  await role.waitFor({ timeout: 5000 }).catch(() => fail('Properties before a type does not list People > Role'));
  await role.click();
  await expect(seeded.Person, 'Person started from Properties');
  if ((await page.getByRole('tab', { name: /Properties/ }).getAttribute('aria-selected')) !== 'true') fail('a property click did not land on Properties');
  const roleHead = await page.locator('.bar-list').nth(1).locator('.caps-heading').innerText().catch(() => '');
  if (roleHead !== 'ROLE') fail(`a click on People > Role opened "${roleHead}"`);
  await nameIs('People', 'Person started');
  if (!(await page.locator('.dock__intro').innerText()).replace(/\s+/g, ' ').includes(`${seeded.Person} of ${total} objects`)) fail('the dock does not say how much of everything the set holds');
  const started = decode(page.url());
  if (started?.start !== 'Person' || started.steps.length) fail(`started exploration ${JSON.stringify(started)}`);

  // One click on the first value filters by it; then Back, Forward, and remove the card.
  const values = page.locator('.bar-list').nth(1).locator('button.bar-row');
  await values.first().waitFor({ timeout: 5000 }).catch(() => fail('no value bars for the default property'));
  const picked = Number((await values.first().locator('.bar-row__count').innerText()).replace(/,/g, ''));
  // Every list has its search bar showing; typing narrows the rows, clearing brings them back.
  const search = page.locator('.bar-list').nth(1).locator('.bar-list__heading input');
  if (!(await search.isVisible())) fail('the value list has no search bar showing');
  // It sits on the heading's line, where the search icon was: the heading row is no taller than the bar itself.
  const row = await page.locator('.bar-list').nth(1).locator('.bar-list__heading').boundingBox();
  const bar = await search.boundingBox();
  if (Math.round(bar.y) !== Math.round(row.y) || Math.round(bar.height) !== Math.round(row.height)) fail(`the search bar is not on the heading's line: heading ${JSON.stringify(row)}, bar ${JSON.stringify(bar)}`);
  // Only the value chart has the bar; the property list keeps its search icon and shows no box until it's clicked.
  const propList = page.locator('.bar-list').nth(0);
  if (!(await propList.getByRole('button', { name: 'Search object properties' }).count()) || (await propList.locator('input').count())) fail('the property list lost its search icon');
  const all = await values.count();
  const word = (await values.first().locator('.bar-row__label').innerText()).trim();
  await search.fill(word);
  const hits = await values.locator('.bar-row__label').allInnerTexts();
  if (!hits.length || hits.some((h) => !h.toLowerCase().includes(word.toLowerCase()))) fail(`searching "${word}" left ${JSON.stringify(hits)}`);
  await search.fill('');
  if ((await values.count()) !== all) fail('clearing the search did not bring the rows back');
  await values.first().click();
  await expect(picked, 'value filter');
  // Clicking the value again, even several times, adds nothing: the path keeps one card for it.
  const cards = await page.locator('.dock__step').count();
  for (let i = 0; i < 3; i++) await values.first().click();
  await page.waitForTimeout(300);
  if ((await page.locator('.dock__step').count()) !== cards) fail(`clicking the same value again added cards: ${cards} became ${await page.locator('.dock__step').count()}`);
  const card = await page.locator('.dock__step').nth(1).innerText();
  if (!card.replace(/\s+/g, ' ').includes(`${seeded.Person} > ${picked}`)) fail(`filter card reads "${card}", want "${seeded.Person} > ${picked}"`);
  await page.goBack();
  await expect(seeded.Person, 'Back');
  await page.goForward();
  await expect(picked, 'Forward');
  await page.getByRole('button', { name: 'Remove this filter' }).click();
  await expect(seeded.Person, 'filter removed');

  // Shift-click gathers values without filtering; Add to filter path applies them, Clear selection drops them.
  const before = page.url();
  await values.first().waitFor({ timeout: 5000 });
  const barsAt = await rowsAt(page, '.bar-list:nth-child(2) button.bar-row', '.bar-row__label');
  await values.first().click({ modifiers: ['Shift'] });
  if (page.url() !== before) fail('a Shift-click filtered straight away');
  const barsNow = await rowsAt(page, '.bar-list:nth-child(2) button.bar-row', '.bar-row__label');
  if (barsNow !== barsAt) fail(`picking a value moved the rows: ${barsAt} became ${barsNow}`);
  if ((await values.first().getAttribute('aria-pressed')) !== 'true') fail('a Shift-click did not pick the value');
  await page.getByRole('button', { name: 'Clear selection' }).click();
  if (await page.getByRole('button', { name: 'Add to filter path' }).count()) fail('Clear selection left Add to filter path showing');
  await values.first().click({ modifiers: ['Shift'] });
  await add();
  await expect(picked, 'Shift-click then Add to filter path');
  await page.goBack();
  await expect(seeded.Person, 'Back after Add to filter path');

  // One click on a link searches around to digital accounts: the platform histogram opens by itself (demo step 3).
  await page.getByRole('tab', { name: /Links/ }).click();
  const link = page.getByRole('button', { name: /^Digital account\b/ });
  const linked = Number((await link.locator('.bar-row__count').innerText()).replace(/,/g, ''));
  await link.click();
  await expect(linked, 'Search Around');
  await nameIs('People › Digital accounts', 'Search Around');
  const heading = await page.locator('.bar-list').nth(1).locator('.caps-heading').innerText().catch(() => '');
  if (heading !== 'PLATFORM') fail(`after Search Around the values are "${heading}", want PLATFORM`);
  if (!(await page.locator('.bar-list').nth(1).locator('.bar-row').count())) fail('no platform bars');
  const small = await smallText(page);
  if (small.length) fail(`explorer text under 14px: ${small.slice(0, 5).join('; ')}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, `explorer-${tag}-platform.png`) });

  // View results: Browser lists the set; Back to exploration returns to it.
  await page.getByRole('link', { name: 'View results' }).click();
  await page.locator('.result-item').first().waitFor({ timeout: 10000 }).catch(() => fail('View results listed nothing'));
  if (new URL(page.url()).pathname !== `/${FIRST.id}/browser`) fail(`View results landed on ${page.url()}`);
  const items = await page.locator('.result-item').count();
  const title = (await page.locator('.result-list__title').innerText()).replace(/\s+/g, ' ');
  if (items !== Math.min(linked, 50) || !title.includes(`Showing ${items} of ${linked}`)) fail(`Browser lists ${items}, title "${title}", want ${linked}`);
  const list = await page.locator('.result-list').boundingBox();
  if (Math.round(list.x) !== 56 || Math.round(list.width) !== 340) fail(`result list ${JSON.stringify(list)}, want 340 wide at x 56`);
  const backFace = await page.locator('.result-list__head .caps-heading').evaluate((el) => { const s = getComputedStyle(el); return `${s.fontFamily.replace(/["']/g, '')}|${s.fontWeight}|${s.textTransform}`; });
  if (!backFace.startsWith(LABEL_FACE) || !backFace.endsWith('|700|uppercase')) fail(`Back to exploration set in ${backFace}, want ${LABEL_FACE} Bold in capitals`);
  await page.screenshot({ path: join(shots, `browser-${tag}.png`) });

  // Opening a result is the profile's, Builder 2's since the parallel builders (09.10.2026), and proven by its own
  // smoke (scripts/smoke-profile.mjs). This smoke keeps the list and the way back.
  await page.getByRole('link', { name: 'Back to exploration' }).click();
  await expect(linked, 'Back to exploration');
  if (decode(page.url())?.steps?.[0]?.pivot !== 'digitalAccounts') fail(`Back to exploration lost the set: ${page.url()}`);

  // A link that won't decode says so.
  await page.goto(origin + `/${FIRST.id}/explorer?exploration=broken`, { waitUntil: 'load' });
  await page.getByText('This exploration link is broken').waitFor({ timeout: 5000 }).catch(() => fail('a broken link did not say so'));
  await page.goto(origin + `/${FIRST.id}/explorer`, { waitUntil: 'load' });
  await page.locator('.bar-row').first().waitFor({ timeout: 10000 });

  // Links before a type lists every type's links; one click searches around from that type.
  await page.getByRole('tab', { name: /Links/ }).click();
  const owner = page.getByRole('button', { name: /^Owner\s*of Digital accounts/ });
  await owner.waitFor({ timeout: 10000 }).catch(() => fail('Links before a type does not list Owner of Digital accounts'));
  const owners = Number((await owner.locator('.bar-row__count').innerText()).replace(/,/g, ''));
  await owner.click();
  await expect(owners, 'Search Around from the Links tab');
  await nameIs('Digital accounts › People', 'Search Around from the Links tab');
  await page.goto(origin + `/${FIRST.id}/explorer`, { waitUntil: 'load' });
  await page.locator('.bar-row').first().waitFor({ timeout: 10000 });
}

for (const [width, height] of [[1440, 900], [1920, 1080]]) {
  const tag = `${width}x${height}`;
  const fail = (msg) => failures.push(`${tag} ${msg}`);
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fail(`console: ${m.text()}`); });

  await page.goto(origin + '/', { waitUntil: 'load' });
  await page.locator('.app-shell').waitFor({ timeout: 10000 });
  await page.locator('.bar-row').first().waitFor({ timeout: 15000 }).catch(() => fail('the Object Explorer listed no types'));
  await page.evaluate(() => document.fonts.ready);
  if (new URL(page.url()).pathname !== `/${FIRST.id}/explorer`) fail(`bare / did not settle on /${FIRST.id}/explorer: ${page.url()}`);

  const probe = await page.evaluate(({ LABEL_FACE, BODY_FACE }) => {
    const $ = (s) => document.querySelector(s);
    const cs = (s) => (($(s) && getComputedStyle($(s))) || null);
    const bare = (s) => s.replace(/["']/g, '');
    const box = (s) => { const el = $(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    // Text size floor: every element that paints its own text node.
    const small = [];
    for (const el of document.querySelectorAll('.app-shell *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && parseFloat(getComputedStyle(el).fontSize) < 14) small.push(`${el.className || el.tagName} ${getComputedStyle(el).fontSize}`);
    }
    const scroller = document.scrollingElement;
    return {
      dark: document.body.classList.contains('bp6-dark'),
      mark: (() => { const m = $('svg.appbar__mark'); const b = m?.getBoundingClientRect(); return !!m && !!m.querySelector('path') && b.height === 22; })(),
      word: $('.appbar__wordmark')?.textContent ?? '',
      views: [...document.querySelectorAll('.rail__views .rail__entry')].map((e) => e.getBoundingClientRect().y),
      railIcons: [...document.querySelectorAll('.rail .rail__entry svg')].map((s) => s.getBoundingClientRect().x),
      railPaint: [...document.querySelectorAll('.rail__views .rail__entry')].map((e) => ({
        label: e.getAttribute('aria-label'), open: e.classList.contains('bp6-active'),
        fill: getComputedStyle(e.querySelector('svg')).fill, bg: getComputedStyle(e).backgroundColor,
      })),
      railLabelOpacity: [...document.querySelectorAll('.rail .rail__entry .bp6-button-text')].map((t) => getComputedStyle(t).opacity),
      bg: { rail: cs('.rail')?.backgroundColor, appbar: cs('.appbar')?.backgroundColor, menubar: cs('.menubar')?.backgroundColor, main: cs('.app-shell__main')?.backgroundColor },
      faces: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${bare(f.family)} ${f.weight}`),
      family: {
        menu: bare(cs('.menubar__menus .bp6-button')?.fontFamily ?? ''),
        title: bare(cs('.menubar__title')?.fontFamily ?? ''),
        word: bare(cs('.appbar__wordmark')?.fontFamily ?? ''),
        heading: bare(cs('.view-panel .bp6-heading')?.fontFamily ?? ''),
        search: bare(cs('.appbar__search input')?.fontFamily ?? ''),
      },
      small,
      docScroll: { h: scroller.scrollHeight - innerHeight, w: scroller.scrollWidth - innerWidth },
      title: $('.menubar__title')?.textContent ?? '',
      railLine: cs('.rail__top')?.boxShadow ?? '',
      toggleLabel: $('.rail__top .bp6-button-text')?.textContent ?? '',
      appbarLine: cs('.appbar')?.borderBottomColor ?? '',
      geometry: {
        rail: box('.rail'), toggle: box('.rail__top .rail__entry'), entry: box('.rail__views .rail__entry'), appbar: box('.appbar'), mark: box('.appbar__mark'),
        word: box('.appbar__wordmark'), search: box('.appbar__search'), menubar: box('.menubar'), main: box('.app-shell__main'), panel: box('.view-panel'),
      },
    };
  }, { LABEL_FACE, BODY_FACE });

  if (!probe.dark) fail('bp6-dark missing on body');
  // The owner's Figma version, with the brand cut about 10% on the owner's word: dog at x 52, 22px tall; BARGHEST 20px
  // at x 79; search 15px after the name; the toggle at the rail's top; rail icons 4px apart.
  const g = probe.geometry;
  if (!probe.mark || Math.round(g.mark?.x) !== 52) fail(`the BARGHEST mark is not drawn 22px tall at x 52 in the app bar ${JSON.stringify(g.mark)}`);
  if (probe.word !== 'BARGHEST' || !probe.family.word.startsWith(LABEL_FACE) || Math.round(g.word?.x) !== 79 || g.word?.h !== 20) fail(`wordmark "${probe.word}" in "${probe.family.word}" at ${JSON.stringify(g.word)}, want BARGHEST 20px in ${LABEL_FACE} at x 79`);
  if (Math.abs((g.search?.x ?? 0) - (g.word.x + g.word.w + 15)) > 1) fail(`search at x ${g.search?.x}, want 15px after the name`);
  if (!g.toggle || g.toggle.x !== 4 || g.toggle.y !== 3) fail(`toggle at ${JSON.stringify(g.toggle)}, want the rail's top cell (4, 3)`);
  // The toggle's label is "Collapse" even while the rail is closed (hidden then), so "Expand" never shows.
  if (probe.toggleLabel !== 'Collapse') fail(`the closed rail's toggle label is "${probe.toggleLabel}", want Collapse (hidden)`);
  // The app bar's bottom line runs on under the toggle, in the same colour and at the same height.
  const railTop = await page.locator('.rail__top').boundingBox();
  if (!probe.railLine.includes(probe.appbarLine) || !probe.railLine.endsWith('0px -1px 0px 0px inset') || Math.round(railTop.y + railTop.height) !== Math.round(g.appbar.y + g.appbar.h)) fail(`no app bar line under the rail toggle: ${probe.railLine}, app bar line ${probe.appbarLine}`);
  const steps = probe.views.slice(1).map((y, i) => y - probe.views[i]);
  if (!steps.length || steps.some((s) => s !== 34)) fail(`rail icons step ${steps.join(', ')}px, want 34 (30 plus a 4px gap)`);
  for (const k of ['rail', 'appbar', 'menubar']) if (probe.bg[k] !== DARK_GRAY_1) fail(`${k} background ${probe.bg[k]}, want dark-gray-1 ${DARK_GRAY_1}`);
  if (probe.bg.main !== DARK_GRAY_2) fail(`main background ${probe.bg.main}, want dark-gray-2 ${DARK_GRAY_2}`);
  for (const r of probe.railPaint) {
    const want = VIEW_FILLS[r.label];
    if (r.fill !== `rgb(${want.join(', ')})`) fail(`rail icon ${r.label} filled ${r.fill}, want rgb(${want.join(', ')})`);
  }
  const openTile = probe.railPaint.find((r) => r.open)?.bg;
  if (probe.railPaint.filter((r) => r.open).length !== 1) fail('want exactly one open view in the rail');
  if (!probe.faces.some((f) => f.startsWith(LABEL_FACE + ' '))) fail(`${LABEL_FACE} not among loaded faces: ${probe.faces.join(', ')}`);
  if (!probe.faces.some((f) => f.startsWith(BODY_FACE))) fail(`${BODY_FACE} not among loaded faces: ${probe.faces.join(', ')}`);
  // D-DIN only on big or all-caps text (owner, 09.10.2026); menus and the menu bar title are Source Sans 3.
  if (!probe.family.heading.startsWith(LABEL_FACE)) fail(`heading set in "${probe.family.heading}", want ${LABEL_FACE}`);
  for (const k of ['menu', 'title']) if (!probe.family[k].startsWith(BODY_FACE)) fail(`${k} set in "${probe.family[k]}", want ${BODY_FACE}`);
  if (!probe.family.search.startsWith(BODY_FACE)) fail(`search input set in "${probe.family.search}", want ${BODY_FACE}`);
  if (probe.small.length) fail(`text under 14px: ${probe.small.slice(0, 5).join('; ')}`);
  if (probe.docScroll.h > 0 || probe.docScroll.w > 0) fail(`document scrolls ${JSON.stringify(probe.docScroll)}`);
  if (probe.title !== 'All objects') fail(`menu bar title reads "${probe.title}", want All objects`);
  if (Math.round(probe.geometry.rail?.w ?? 0) !== 40) fail(`collapsed rail ${probe.geometry.rail?.w}px, want 40`);
  await page.screenshot({ path: join(shots, `shell-${tag}.png`) });

  // Tooltip on the collapsed rail, shot after its fade.
  await page.locator('.rail__views .rail__entry').first().hover();
  const tip = page.locator('.bp6-tooltip', { hasText: 'Files' });
  try { await tip.waitFor({ state: 'visible', timeout: 3000 }); } catch { fail('no tooltip on the collapsed rail'); }
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(shots, `shell-${tag}-tooltip.png`) });
  await page.mouse.move(width / 2, height / 2);

  await exploreFlow(page, tag, fail, width);
  await intakeFlow(page, tag, fail);
  await page.goto(origin + `/${FIRST.id}/explorer`, { waitUntil: 'load' });
  await page.locator('.bar-row').first().waitFor({ timeout: 15000 }).catch(() => fail('Object Explorer did not come back after Files'));

  // Expanded rail: labels show in D-DIN and are not link-blue.
  await page.getByRole('button', { name: 'Expand' }).click();
  await page.waitForTimeout(300);
  const expanded = await page.evaluate(() => {
    const label = document.querySelector('.rail__views .rail__entry .bp6-button-text');
    const s = label && getComputedStyle(label);
    return {
      w: document.querySelector('.rail').getBoundingClientRect().width, color: s?.color, family: s?.fontFamily.replace(/["']/g, ''), text: label?.textContent,
      icons: [...document.querySelectorAll('.rail .rail__entry svg')].map((v) => v.getBoundingClientRect().x),
      opacity: [...document.querySelectorAll('.rail .rail__entry .bp6-button-text')].map((t) => getComputedStyle(t).opacity),
      toggleText: document.querySelector('.rail__top .rail__entry')?.innerText.trim(),
    };
  });
  if (expanded.toggleText !== 'Collapse') fail(`the open rail's toggle reads "${expanded.toggleText}", want Collapse`);
  if (Math.round(expanded.w) !== 200) fail(`expanded rail ${expanded.w}px, want 200`);
  // Icons and labels open as one: no icon moves, labels hidden collapsed and shown expanded.
  if (probe.railIcons.some((x) => x !== 10) || expanded.icons.some((x) => x !== 10)) fail(`rail icons moved: collapsed ${probe.railIcons.join(',')} expanded ${expanded.icons.join(',')}, want 10 throughout`);
  if (probe.railLabelOpacity.some((o) => o !== '0') || expanded.opacity.some((o) => o !== '1')) fail(`rail label opacity collapsed ${probe.railLabelOpacity.join(',')} expanded ${expanded.opacity.join(',')}`);
  if (expanded.text !== 'Files') fail(`expanded rail first label "${expanded.text}"`);
  if (LINK_BLUE.includes(expanded.color)) fail(`rail label repainted link-blue ${expanded.color}`);
  if (!expanded.family?.startsWith(BODY_FACE)) fail(`rail label set in "${expanded.family}", want ${BODY_FACE}`);
  await page.screenshot({ path: join(shots, `shell-${tag}-expanded.png`) });

  // The URL drives the view: a rail click moves it, back returns.
  // Graph's own words are Builder 3's (a home page now reads "All graphs"), so this checks the address and that a view
  // opened, never its title text.
  await page.getByRole('link', { name: 'Graph' }).click();
  await page.waitForURL((u) => u.pathname === `/${FIRST.id}/graph`, { timeout: 3000 }).catch(() => fail(`Graph click landed on ${page.url()}`));
  const graphTitle = await page.locator('.menubar__title').innerText().catch(() => '');
  if (!graphTitle.trim() || /Not found/.test(graphTitle)) fail(`Graph click did not open Graph: the menu bar reads "${graphTitle}"`);
  // Selecting a view changes nothing about its colours: the highlight is the same grey for every view, and the icon
  // keeps its own colour.
  await page.mouse.move(width / 2, height / 2);
  await page.waitForTimeout(200);
  const graphOpen = await page.evaluate(() => {
    const e = document.querySelector('.rail__views .rail__entry.bp6-active');
    return e && { label: e.getAttribute('aria-label'), bg: getComputedStyle(e).backgroundColor, fill: getComputedStyle(e.querySelector('svg')).fill };
  });
  if (graphOpen?.label !== 'Graph' || graphOpen.bg !== openTile) fail(`open highlight changed with the view: Object Explorer ${openTile}, Graph ${JSON.stringify(graphOpen)}`);
  if (graphOpen?.fill !== `rgb(${VIEW_FILLS.Graph.join(', ')})`) fail(`Graph icon recoloured when open: ${graphOpen?.fill}`);
  await page.goBack();
  await page.locator('.menubar__title', { hasText: 'All objects' }).waitFor({ timeout: 3000 }).catch(() => fail('back did not return to Object Explorer'));

  if (showGeometry) console.log(tag, JSON.stringify({ ...probe.geometry, faces: probe.faces, family: probe.family, expanded }, null, 1));
  await page.close();
}

await browser.close();
server.close();

const ok = failures.length === 0;
console.log(ok ? `barghest: OK (shell, Object Explorer, Browser list, Data Sources, Files at 1440x900 and 1920x1080, 0 errors) ${Date.now() - t0}ms  dist-shots/*.png` : `barghest: FAIL\n${failures.join('\n')}`);
process.exit(ok ? 0 : 1);
