// BARGHEST Graph smoke: prove S4 in headless Chromium against a running dev server (5183 by default, BARGHEST_DEV_PORT
// to change it) and the engine on 8787, at 1440 x 900 and 1920 x 1080. Objects are found by query, never by id: the
// focus is the Person at the end of the most Relationships, the path target the first Incident, the edge to click a
// Relationship of the focus that cites a passage. Checks: the graph opens on the focus with its neighbours around it;
// a double-click expands a node; an edge click shows its passage in Selection; &to= draws at least one path; all-caps
// headings in D-DIN Bold; no text under 14px; the document never scrolls; zero console errors. Screenshots to
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
const relationships = await list('Relationship');
const ends = new Map();
for (const r of relationships) {
  for (const [type, pk] of [
    [r.fromType, r.fromId],
    [r.toType, r.toId],
  ]) {
    if (type === 'Person') ends.set(pk, (ends.get(pk) ?? 0) + 1);
  }
}
const cited = (pk) => relationships.find((r) => r.passageIds?.length && ((r.fromType === 'Person' && r.fromId === pk) || (r.toType === 'Person' && r.toId === pk)));
const people = [...ends].sort((a, b) => b[1] - a[1]).map(([pk]) => pk);
const focusPk = people.find((pk) => cited(pk)) ?? people[0];
if (!focusPk) {
  console.error('smoke-graph: no Person is the end of any Relationship; nothing to graph');
  process.exit(1);
}
const persons = await list('Person');
const focusObj = persons.find((p) => String(p.__primaryKey) === focusPk);
const focus = `Person:${focusPk}`;
const evidenceRel = cited(focusPk);
const passage = evidenceRel ? await fetch(`${ENGINE}/api/v2/ontologies/${rid}/objects/Passage/${encodeURIComponent(evidenceRel.passageIds[0])}`, { headers: AUTH }).then((r) => (r.ok ? r.json() : null)) : null;
const incident = (await list('Incident'))[0];
const target = incident ? `Incident:${incident.__primaryKey}` : null;
const investigation = focusObj?.scenario ?? (await fetch(`${ENGINE}/barghest/investigations`).then((r) => r.json())).investigations[0].id;
console.log(`focus ${focus} (${focusObj?.__title}), path target ${target ?? 'none'}, investigation ${investigation}`);

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

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  const tag = `${viewport.width}x${viewport.height}`;
  const { page, errors } = await open(viewport);

  // With nothing in the address, the empty canvas starts a graph from a search.
  await page.goto(`${BASE}/${investigation}/graph`);
  const name = focusObj?.__title ?? focusPk;
  await page.getByPlaceholder('Search by name').fill(name);
  await page.locator('.graph-search__menu .bp6-menu-item', { hasText: name }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll('.graph-node').length > 1, null, { timeout: 15000 }).catch(() => {});
  check((await page.locator('.graph-node').count()) > 1 && new URL(page.url()).searchParams.get('focus') === focus, `${tag}: the empty canvas starts a graph on "${name}" found by search`);

  await page.goto(`${BASE}/${investigation}/graph?${new URLSearchParams({ focus })}`);

  // Opens on the focus, then its neighbours arrive around it.
  const nodes = page.locator('.graph-node');
  await page.waitForFunction(() => document.querySelectorAll('.graph-node').length > 1, null, { timeout: 15000 }).catch(() => {});
  const opened = await nodes.count();
  check(opened > 1, `${tag}: opens on the focus with its neighbours (${opened} objects)`);
  await page.waitForFunction(() => !document.querySelector('.graph-node__label.bp6-skeleton'), null, { timeout: 10000 }).catch(() => {});
  check(await page.locator('.graph-node__label', { hasText: focusObj?.__title ?? focusPk }).first().isVisible(), `${tag}: the focus shows by name, "${focusObj?.__title}"`);
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

  // An edge click shows its evidence in Selection.
  if (evidenceRel && passage) {
    const edge = page.locator(`.react-flow__edge[data-id="rel:${evidenceRel.relationshipId ?? evidenceRel.__primaryKey}"]`);
    await edge.waitFor({ timeout: 5000 }).catch(() => {});
    await edge.dispatchEvent('click');
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

  // Paths from the focus to the Incident.
  if (target) {
    await page.goto(`${BASE}/${investigation}/graph?${new URLSearchParams({ focus, to: target })}`);
    await page.locator('.graph-path').first().waitFor({ timeout: 15000 }).catch(() => {});
    const drawn = await page.locator('.graph-path').count();
    check(drawn > 0, `${tag}: &to= draws ${drawn} path(s) to ${incident.__title}`);
    if (drawn > 0) {
      await page.locator('.graph-path').first().click();
      await page.waitForTimeout(300);
      check((await page.locator('.graph-edge--lit').count()) > 0, `${tag}: a path row lights its edges`);
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(shots, `${tag}-4-paths.png`) });
  }

  // Back lands on the same graph.
  const before = await nodes.count();
  await page.reload();
  await page.waitForFunction((n) => document.querySelectorAll('.graph-node').length >= n, before, { timeout: 10000 }).catch(() => {});
  check((await nodes.count()) === before, `${tag}: a refresh keeps the same ${before} objects`);

  const caps = await capsHeadings(page, '.graph');
  check(caps.count > 0 && !caps.bad.length && caps.loaded, `${tag}: all-caps headings in D-DIN Bold 14px (${caps.count} checked${caps.bad.length ? `; ${caps.bad.join('; ')}` : ''}${caps.loaded ? '' : '; D-DIN Bold not loaded'})`);
  const small = await textSizes(page, '.graph');
  check(!small.length, `${tag}: no text under 14px${small.length ? ` (${small.slice(0, 4).join('; ')})` : ''}`);
  check(await noScroll(page), `${tag}: the document never scrolls`);
  check(!errors.length, `${tag}: zero console errors${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`);
  await page.close();
}

await browser.close();
console.log(failures.length ? `\nsmoke-graph: ${failures.length} failed` : '\nsmoke-graph: all passed');
process.exit(failures.length ? 1 : 0);
