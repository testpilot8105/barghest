// BARGHEST Graph smoke: prove S4 in headless Chromium against a running dev server (5183 by default, BARGHEST_DEV_PORT
// to change it) and the engine on 8787, at 1440 x 900 and 1920 x 1080. Objects are found by query, never by id: the
// focus is the canonical Person at the end of the most Relationships, the path target the investigation's canonical
// Incident, the edge to click a Relationship of the focus that cites a passage. Graphs are files: the smoke makes its
// own through the engine, works in it, and deletes it, then checks the engine holds nothing it made. Checks: the home
// lists the investigation's graphs and opens one; an empty file starts from a search and saves itself; a double-click
// expands a node; an edge's evidence opens the drawer; a file with a path target draws at least one path; a refresh
// reopens the same canvas; a link naming an object opens that object's own file; rename and delete from the home;
// all-caps headings in D-DIN Bold; no text under 14px; the document never scrolls; zero console errors. Screenshots to
// dist-shots/graph/. Exit 1 on any failure.
// Run: node scripts/smoke-graph.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(app, 'dist-shots', 'graph');
mkdirSync(shots, { recursive: true });
const BASE = `http://localhost:${process.env.BARGHEST_DEV_PORT ?? 5183}`;
const ENGINE = `http://localhost:${process.env.BARGHEST_ENGINE_PORT ?? 8787}`;
const AUTH = { authorization: 'Bearer myAccessToken' };

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

const health = await fetch(`${ENGINE}/barghest/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error(`smoke-graph: the engine is not answering at ${ENGINE}`);
  process.exit(1);
}
const rid = health.ontology.rid;
const list = (type) => fetch(`${ENGINE}/api/v2/ontologies/${rid}/objects/${type}?pageSize=1000`, { headers: AUTH }).then((r) => r.json()).then((b) => b.data ?? []);

// ---- The objects, by query ----
// The graph has one node per real thing: a Relationship's ends are re-pointed at canonical objects in from<Type>Id and
// to<Type>Id (engine-api.md, P6), and an object with a canonicalId is a mention merged into another.
const relationships = await list('Relationship');
const endOf = (r, side) => [r[`${side}Type`], r[`${side}${r[`${side}Type`]}Id`] || r[`${side}Id`]];
const persons = await list('Person');
const merged = new Set(persons.filter((p) => p.canonicalId).map((p) => String(p.__primaryKey)));
const ends = new Map();
for (const r of relationships) {
  for (const [type, pk] of [endOf(r, 'from'), endOf(r, 'to')]) {
    if (type === 'Person' && !merged.has(pk)) ends.set(pk, (ends.get(pk) ?? 0) + 1);
  }
}
const touches = (r, pk) => [endOf(r, 'from'), endOf(r, 'to')].some(([type, id]) => type === 'Person' && id === pk);
const cited = (pk) => relationships.find((r) => r.passageIds?.length && touches(r, pk));
const people = [...ends].sort((a, b) => b[1] - a[1]).map(([pk]) => pk);
const focusPk = people.find((pk) => cited(pk)) ?? people[0];
if (!focusPk) {
  console.error('smoke-graph: no Person is the end of any Relationship; nothing to graph');
  process.exit(1);
}
const focusObj = persons.find((p) => String(p.__primaryKey) === focusPk);
const focus = `Person:${focusPk}`;
const name = focusObj?.__title ?? focusPk;
const evidenceRel = cited(focusPk);
const passage = evidenceRel ? await fetch(`${ENGINE}/api/v2/ontologies/${rid}/objects/Passage/${encodeURIComponent(evidenceRel.passageIds[0])}`, { headers: AUTH }).then((r) => (r.ok ? r.json() : null)) : null;
const incidents = await list('Incident');
const incident = incidents.find((i) => !i.canonicalId && i.scenario === focusObj?.scenario) ?? incidents[0];
const target = incident ? `Incident:${incident.__primaryKey}` : null;
const investigation = focusObj?.scenario ?? (await fetch(`${ENGINE}/barghest/investigations`).then((r) => r.json())).investigations[0].id;
console.log(`focus ${focus} (${name}), path target ${target ?? 'none'}, investigation ${investigation}`);

// ---- Saved graphs: what was there before, so only what the smoke makes is removed ----
const saved = {
  list: () => fetch(`${ENGINE}/barghest/saved?${new URLSearchParams({ investigation, kind: 'graph' })}`).then((r) => r.json()).then((b) => b.items ?? []),
  get: (id) => fetch(`${ENGINE}/barghest/saved-item?${new URLSearchParams({ id })}`).then((r) => (r.ok ? r.json() : null)),
  post: (path, body) => fetch(`${ENGINE}/barghest/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()),
};
const existing = new Set((await saved.list()).map((i) => i.id));
// When the focus already has its own file, it belongs to someone; the link test leaves it alone.
const taken = (await Promise.all([...existing].map(saved.get))).some((i) => i?.body?.origin === focus);
const made = [];
const stamp = `Smoke graph ${Date.now().toString(36)}`;
const savedNow = (page) => page.locator('.file-status', { hasText: /^Saved$/ }).waitFor({ timeout: 8000 }).catch(() => {});

const browser = await chromium.launch();

async function open(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, errors };
}

const textSizes = (page, scope) =>
  page.evaluate((sel) => {
    const small = [];
    for (const el of document.querySelectorAll(`${sel} *`)) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own || !el.getClientRects().length) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < 14) small.push(`${el.className || el.tagName}: ${px}px "${el.textContent.trim().slice(0, 30)}"`);
    }
    return small;
  }, scope);

const capsHeadings = (page, scope) =>
  page.evaluate((sel) => {
    const bad = [];
    const heads = [...document.querySelectorAll(`${sel} .caps-heading`)].filter((el) => el.getClientRects().length);
    for (const el of heads) {
      const cs = getComputedStyle(el);
      if (!cs.fontFamily.startsWith("'D-DIN'") && !cs.fontFamily.startsWith('D-DIN')) bad.push(`${el.textContent}: ${cs.fontFamily}`);
      if (cs.fontWeight !== '700' || cs.textTransform !== 'uppercase' || cs.fontSize !== '14px') bad.push(`${el.textContent}: ${cs.fontWeight} ${cs.textTransform} ${cs.fontSize}`);
    }
    const loaded = [...document.fonts].some((f) => f.family.replace(/['"]/g, '') === 'D-DIN' && f.weight === '700' && f.status === 'loaded');
    return { count: heads.length, bad, loaded };
  }, scope);

const noScroll = (page) => page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight && document.scrollingElement.scrollWidth <= innerWidth && scrollY === 0);
const hasSaved = (page) => page.waitForFunction(() => new URL(location.href).searchParams.has('saved'), null, { timeout: 8000 }).catch(() => {});
const grown = (page, n = 1) => page.waitForFunction((min) => document.querySelectorAll('.graph-node').length > min, n, { timeout: 15000 }).catch(() => {});

try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    const tag = `${viewport.width}x${viewport.height}`;
    const { page, errors } = await open(viewport);

    // The home lists this investigation's graphs; a click opens one.
    const mine = await saved.post('saved', { investigation, kind: 'graph', name: `${stamp} ${tag}`, body: {} });
    made.push(mine.id);
    await page.goto(`${BASE}/${investigation}/graph`);
    const row = page.locator('.home-table__row', { hasText: mine.name });
    await row.waitFor({ timeout: 8000 }).catch(() => {});
    check(await row.isVisible().catch(() => false), `${tag}: the home lists this investigation's graphs, "${mine.name}" among them`);
    check(await page.getByText('All graphs', { exact: true }).first().isVisible().catch(() => false), `${tag}: the menu bar says "All graphs" on the home`);
    await page.screenshot({ path: join(shots, `${tag}-0-home.png`) });
    const homeSmall = await textSizes(page, '.home');
    check(!homeSmall.length, `${tag}: no text under 14px on the home${homeSmall.length ? ` (${homeSmall.slice(0, 4).join('; ')})` : ''}`);
    await row.click();
    await hasSaved(page);
    check(new URL(page.url()).searchParams.get('saved') === mine.id, `${tag}: a row opens its graph at ?saved=${mine.id}`);
    await page.getByText(mine.name, { exact: true }).first().waitFor({ timeout: 5000 }).catch(() => {});
    check(await page.getByText(mine.name, { exact: true }).first().isVisible().catch(() => false), `${tag}: the menu bar names the open graph`);

    // The empty file starts from a search, and saves itself.
    await page.getByPlaceholder('Search by name').fill(name);
    await page.locator('.graph-search__menu .bp6-menu-item', { hasText: name }).first().click({ timeout: 8000 }).catch(() => {});
    await grown(page);
    await savedNow(page);
    const nodes = page.locator('.graph-node');
    const stored = await saved.get(mine.id);
    check(stored?.body?.focus === focus && stored.body.nodes?.length === (await nodes.count()), `${tag}: the canvas saves itself into the file (focus ${stored?.body?.focus}, ${stored?.body?.nodes?.length} objects stored)`);

    // Opens on the focus with its neighbours around it.
    const opened = await nodes.count();
    check(opened > 1, `${tag}: opens on the focus with its neighbours (${opened} objects)`);
    await page.waitForFunction(() => !document.querySelector('.graph-node__label.bp6-skeleton'), null, { timeout: 10000 }).catch(() => {});
    check(await page.locator('.graph-node__label', { hasText: name }).first().isVisible(), `${tag}: the focus shows by name, "${name}"`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(shots, `${tag}-1-focus.png`) });

    // A double-click expands: try neighbours until one adds objects.
    let grew = false;
    for (let i = 1; i < Math.min(opened, 8) && !grew; i++) {
      const before = await nodes.count();
      await nodes.nth(i).locator('.graph-node__tile').dblclick();
      await page.waitForFunction((n) => document.querySelectorAll('.graph-node').length > n, before, { timeout: 4000 }).catch(() => {});
      grew = (await nodes.count()) > before;
    }
    check(grew, `${tag}: a double-click expands a node (${await nodes.count()} objects now)`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(shots, `${tag}-2-expanded.png`) });

    // The Histogram helper counts what's on the canvas; the docked Timeline draws its dated events by kind.
    check((await page.locator('.graph__helper .graph-bucket').count()) > 0, `${tag}: the Histogram lists object types, link types and property values (${await page.locator('.graph__helper .graph-bucket').count()} rows)`);
    await page.locator('.graph-chart__seg').first().waitFor({ timeout: 8000 }).catch(() => {});
    const segs = await page.locator('.graph-chart__seg').count();
    check(segs > 0 && (await page.locator('.graph-legend__list .bp6-checkbox').count()) > 0, `${tag}: the docked Timeline draws ${segs} kind segments with a ticked legend of kinds`);
    if (segs > 0) {
      await page.locator('.graph-chart__bin:has(.graph-chart__seg)').last().click();
      await page.waitForTimeout(300);
      check((await page.locator('.graph-node--picked').count()) > 0, `${tag}: a timeline bar picks its objects on the canvas (${await page.locator('.graph-node--picked').count()} picked)`);
      await page.locator('.react-flow__pane').click({ position: { x: 20, y: 200 } }).catch(() => {});
    }

    // The right-click menu offers Search around by kind.
    await nodes.first().locator('.graph-node__tile').click({ button: 'right' });
    const menu = page.locator('.graph-menu');
    await menu.waitFor({ timeout: 3000 }).catch(() => {});
    const menuText = (await menu.textContent().catch(() => '')) ?? '';
    check(['Search around', 'Find path to…', 'Open profile', 'Remove from graph'].every((t) => menuText.includes(t)), `${tag}: the right-click menu lists Search around, Find path to…, Open profile, Remove from graph`);
    // A click on empty canvas closes it, as it would for a person.
    const pane = await page.locator('.react-flow__pane').boundingBox();
    await page.mouse.click(pane.x + 12, pane.y + 12);
    await menu.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    check(!(await menu.isVisible().catch(() => false)), `${tag}: a click on empty canvas closes the menu`);

    // An edge's evidence opens the drawer with its passage.
    if (evidenceRel && passage) {
      const edge = page.locator(`.react-flow__edge[data-id="rel:${evidenceRel.relationshipId ?? evidenceRel.__primaryKey}"]`);
      await edge.waitFor({ timeout: 5000 }).catch(() => {});
      await edge.dispatchEvent('click', undefined, { timeout: 5000 }).catch(() => {});
      await page.getByRole('button', { name: /Show evidence/ }).click({ timeout: 5000 }).catch(() => {});
      const drawer = page.locator('.evidence-drawer');
      const snippet = String(passage.text ?? '').trim().slice(0, 40);
      await drawer.getByText(snippet, { exact: false }).first().waitFor({ timeout: 5000 }).catch(() => {});
      check(await drawer.getByText(snippet, { exact: false }).first().isVisible().catch(() => false), `${tag}: an edge's Show evidence opens the drawer with its passage, "${snippet}…"`);
      await page.screenshot({ path: join(shots, `${tag}-3-evidence.png`) });
      await page.keyboard.press('Escape');
      await drawer.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    } else {
      check(false, `${tag}: an edge click shows its passage (no Relationship of the focus cites a passage)`);
    }

    // A file with a path target draws the paths from the focus to the Incident.
    if (target) {
      await savedNow(page);
      await saved.post('update-saved', { id: mine.id, body: { focus, to: target, nodes: [] } });
      await page.reload();
      await page.locator('.graph-path').first().waitFor({ timeout: 15000 }).catch(() => {});
      const drawn = await page.locator('.graph-path').count();
      check(drawn > 0, `${tag}: a file with a path target draws ${drawn} path(s) to ${incident.__title}`);
      if (drawn > 0) {
        await page.locator('.graph-path').first().click();
        await page.waitForTimeout(300);
        check((await page.locator('.graph-edge--lit').count()) > 0, `${tag}: a path row lights its edges (${await page.locator('.graph-edge--lit').count()} lit)`);
      }
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(shots, `${tag}-4-paths.png`) });
    }

    // A refresh reopens the same canvas from the file, once the canvas has settled (mentions folded) and saved.
    await page
      .waitForFunction(
        () => {
          const n = document.querySelectorAll('.graph-node').length;
          const w = (window.__settle ??= { n, since: Date.now() });
          if (w.n !== n) Object.assign(w, { n, since: Date.now() });
          return Date.now() - w.since > 1500;
        },
        null,
        { timeout: 15000, polling: 250 },
      )
      .catch(() => {});
    await savedNow(page);
    const before = await nodes.count();
    const storedBefore = (await saved.get(mine.id))?.body?.nodes?.length;
    await page.reload();
    await page.waitForFunction((n) => document.querySelectorAll('.graph-node').length >= n, before, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    check((await nodes.count()) === before, `${tag}: a refresh keeps the same ${before} objects (${storedBefore} stored, ${await nodes.count()} after)`);

    const caps = await capsHeadings(page, '.graph');
    check(caps.count > 0 && !caps.bad.length && caps.loaded, `${tag}: all-caps headings in D-DIN Bold 14px (${caps.count} checked${caps.bad.length ? `; ${caps.bad.join('; ')}` : ''}${caps.loaded ? '' : '; D-DIN Bold not loaded'})`);
    const small = await textSizes(page, '.graph');
    check(!small.length, `${tag}: no text under 14px${small.length ? ` (${small.slice(0, 4).join('; ')})` : ''}`);
    check(await noScroll(page), `${tag}: the document never scrolls`);

    // A link from another view that names an object opens that object's own file, made the first time.
    if (viewport.width === 1440) {
      if (taken) console.log(`note  ${tag}: ${focus} already has its own graph; the link test leaves it alone`);
      else {
        await page.goto(`${BASE}/${investigation}/graph?${new URLSearchParams({ focus })}`);
        await hasSaved(page);
        const id = new URL(page.url()).searchParams.get('saved');
        if (id && !existing.has(id)) made.push(id);
        const linked = id ? await saved.get(id) : null;
        check(!!linked && linked.body?.origin === focus && linked.name === name, `${tag}: ?focus= opens the object's own graph, named "${linked?.name}"`);
        await grown(page);
        await savedNow(page);
      }
    }

    // Rename and delete from the home's row menu.
    await page.goto(`${BASE}/${investigation}/graph`);
    await page.getByRole('button', { name: `Actions for ${mine.name}` }).click({ timeout: 8000 }).catch(() => {});
    await page.locator('.bp6-menu-item', { hasText: 'Rename' }).click({ timeout: 3000 }).catch(() => {});
    const renamed = `${mine.name} renamed`;
    await page.getByLabel('New name').fill(renamed, { timeout: 3000 }).catch(() => {});
    await page.keyboard.press('Enter');
    await page.locator('.home-table__row', { hasText: renamed }).waitFor({ timeout: 5000 }).catch(() => {});
    check((await saved.get(mine.id))?.name === renamed, `${tag}: Rename on the home renames the file in the engine`);
    await page.getByRole('button', { name: `Actions for ${renamed}` }).click({ timeout: 5000 }).catch(() => {});
    await page.locator('.bp6-menu-item', { hasText: 'Delete…' }).click({ timeout: 3000 }).catch(() => {});
    await page.locator('.bp6-alert').getByRole('button', { name: 'Delete' }).click({ timeout: 3000 }).catch(() => {});
    await page.locator('.home-table__row', { hasText: renamed }).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    check((await saved.get(mine.id)) === null, `${tag}: Delete on the home asks first, then removes the file from the engine`);

    check(!errors.length, `${tag}: zero console errors${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
  // Teardown: everything the smoke made goes, and the engine is asked whether it did.
  for (const id of made) if (await saved.get(id)) await saved.post('delete-saved', { id });
  const left = (await saved.list()).filter((i) => made.includes(i.id));
  check(!left.length, `teardown: nothing the smoke made is left (${made.length} made${left.length ? `; left: ${left.map((i) => i.name).join(', ')}` : ''})`);
}

console.log(failures.length ? `\nsmoke-graph: ${failures.length} failed` : '\nsmoke-graph: all passed');
process.exit(failures.length ? 1 : 0);
