// BARGHEST profile smoke (S2): the object profile and the evidence drawer, proved in a real browser against Builder 2's
// dev server (5182; BARGHEST_PROFILE_ORIGIN moves it) and the running engine (8787; BARGHEST_ENGINE_PORT). At
// 1440 x 900 and 1920 x 1080: the Person with the most candidates (found by a histogram on canonicalId; on a seed with
// no merges yet, the Person with the most cited relationships) opened on its own and beside the Object Explorer's
// list; every section shows visible text; the header names it and links to Graph, Timeline and the Assistant; the
// drawer opens on a passage with its text and file name, links to Files at that passage and to the stored original,
// and closes on Escape; a link to an object that isn't there says so; all-caps headings in D-DIN Bold; nothing under
// 14px; the document never scrolls; zero console errors. Read-only: nothing is written to the engine. Screenshots to
// dist-shots/profile/. Exit 1 on any failure.
// Run: node scripts/smoke-profile.mjs   (with `pnpm exec vite --port 5182 --strictPort` running)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(app, 'dist-shots', 'profile');
const ORIGIN = process.env.BARGHEST_PROFILE_ORIGIN ?? 'http://localhost:5182';
const ENGINE = `http://127.0.0.1:${process.env.BARGHEST_ENGINE_PORT ?? 8787}`;
const LABEL_FACE = 'D-DIN';
const SECTIONS = ['Properties', 'Sources', 'How it was resolved', 'Links', 'Relationships', 'History'];

const health = await fetch(`${ENGINE}/barghest/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error(`smoke-profile: the engine is not answering on ${ENGINE}`);
  process.exit(1);
}
const appUp = await fetch(ORIGIN).then((r) => r.ok).catch(() => false);
if (!appUp) {
  console.error(`smoke-profile: no app on ${ORIGIN}; start it with pnpm exec vite --port 5182 --strictPort`);
  process.exit(1);
}

// The subject, by query, through the app's own data layer.
const { connect } = await import('../src/data/client.ts');
const { fetchRows, histogram } = await import('../src/data/reads.ts');
const { encodeExploration } = await import('../src/data/exploration.ts');
const dc = await connect(ENGINE);
const all = { start: 'Person', steps: [] };
const merged = (await histogram(dc, all, 'canonicalId')).buckets.filter((b) => b.bucket !== '(empty)' && b.count > 0);
let subject;
let why;
if (merged.length) {
  subject = merged[0].bucket;
  why = `most candidates (${merged[0].count})`;
} else {
  const rels = await fetchRows(dc, { start: 'Relationship', steps: [{ filter: { property: 'fromType', op: 'eq', value: 'Person' } }], pageSize: 500 });
  const cited = new Map();
  for (const r of rels.rows) if ((r.properties.passageIds ?? []).length) cited.set(r.properties.fromId, (cited.get(r.properties.fromId) ?? 0) + 1);
  const top = [...cited].sort((a, b) => b[1] - a[1])[0];
  if (!top) {
    console.error('smoke-profile: no Person has candidates or a cited relationship; nothing to open');
    process.exit(1);
  }
  subject = top[0];
  why = `no merges yet; most cited relationships (${top[1]})`;
}
const person = (await fetchRows(dc, { start: 'Person', steps: [{ filter: { property: 'personId', op: 'eq', value: subject } }], pageSize: 1 })).rows[0];
const investigation = String(person.properties.scenario);
console.log(`smoke-profile: subject ${person.title} (${why}) in ${investigation}`);

const solo = `${ORIGIN}/${investigation}/browser?object=${encodeURIComponent(`Person:${subject}`)}`;
const listed = `${ORIGIN}/${investigation}/browser?${new URLSearchParams({ exploration: encodeExploration(all), object: subject })}`;
const missing = `${ORIGIN}/${investigation}/browser?object=${encodeURIComponent('Person:no-such-object')}`;

mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const failures = [];

async function run(width, height) {
  const tag = `${width}x${height}`;
  const fail = (m) => failures.push(`${tag}: ${m}`);
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  const noScroll = () => page.evaluate(() => { const d = document.scrollingElement; return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth; });
  const capsOk = () =>
    page.evaluate((face) => {
      const heads = [...document.querySelectorAll('.profile-panel .caps-heading, .evidence-drawer .caps-heading')];
      const bad = heads.filter((h) => { const s = getComputedStyle(h); return !(s.fontFamily.replace(/["']/g, '').startsWith(face) && s.fontWeight === '700' && s.textTransform === 'uppercase'); });
      return { n: heads.length, bad: bad.map((h) => h.textContent) };
    }, LABEL_FACE);
  const small = () =>
    page.evaluate(() => [...document.querySelectorAll('.profile-panel *, .evidence-drawer *')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14)
      .map((el) => `${el.className || el.tagName} ${getComputedStyle(el).fontSize}`));
  const sections = () =>
    page.evaluate(() => [...document.querySelectorAll('.profile-section')].map((s) => {
      const r = s.getBoundingClientRect();
      return { head: s.querySelector('.bp6-section-header')?.innerText.split('\n')[0].trim() ?? '', body: s.querySelector('.bp6-section-card')?.innerText.trim() ?? '', x: Math.round(r.x) };
    }));

  // 1. On its own, full width, as another view opens it.
  await page.goto(solo, { waitUntil: 'load' });
  await page.locator('.profile-head h4').waitFor({ timeout: 15000 }).catch(() => fail('solo: no profile header'));
  const head = await page.evaluate(() => ({
    title: document.querySelector('.profile-head h4')?.textContent ?? '',
    type: document.querySelector('.profile-head__type')?.innerText ?? '',
    jumps: [...document.querySelectorAll('.profile-head__actions a')].map((a) => [a.textContent, a.getAttribute('href')]),
    back: !!document.querySelector('.profile-back button'),
    menubar: document.querySelector('.menubar__title')?.textContent ?? '',
  }));
  if (head.title !== person.title) fail(`solo: header names "${head.title}", expected "${person.title}"`);
  if (!head.type.includes('Person')) fail(`solo: header type reads "${head.type}"`);
  if (merged.length && !/Resolved from \d+ sources?/.test(head.type)) fail('solo: no "Resolved from N sources" tag');
  if (!head.back) fail('solo: no Back');
  if (!head.menubar.includes(person.title)) fail(`solo: menu bar reads "${head.menubar}"`);
  const want = [['Open in Graph', `/graph?focus=Person:${subject}`], ['Open in Timeline', `/timeline?object=Person:${subject}`], ['Ask about this', '/assistant?q=']];
  for (const [text, part] of want) {
    const j = head.jumps.find(([t]) => t === text);
    if (!j || !decodeURIComponent(j[1]).includes(part)) fail(`solo: "${text}" links to ${j?.[1] ?? 'nothing'}`);
  }
  const secs = await sections();
  for (const name of SECTIONS) {
    const s = secs.find((x) => x.head.toLowerCase() === name.toLowerCase());
    if (!s) fail(`solo: no ${name} section`);
    else if (!s.body) fail(`solo: ${name} shows no text`);
  }
  const columns = new Set(secs.map((s) => s.x)).size;
  if (!(await noScroll())) fail('solo: the document scrolls');
  await page.screenshot({ path: join(shots, `solo-${tag}.png`) });

  // 2. The drawer, from a spelling under Sources, or else from a relationship's evidence.
  const source = page.locator('.profile-section button.profile-row:not([disabled])').first();
  const evidence = page.locator('.profile-rel__evidence:not([disabled])').first();
  const opener = (await source.count()) ? source : evidence;
  if (!(await opener.count())) fail('drawer: nothing on the profile opens evidence');
  else {
    await opener.click();
    await page.locator('.evidence-passage__text').first().waitFor({ timeout: 10000 }).catch(() => fail('drawer: no passage text'));
    await page.waitForTimeout(400);
    const d = await page.evaluate(() => ({
      text: document.querySelector('.evidence-passage__text')?.textContent?.trim() ?? '',
      file: document.querySelector('.evidence-passage__file strong')?.textContent?.trim() ?? '',
      title: document.querySelector('.evidence-drawer .bp6-drawer-header')?.innerText.trim() ?? '',
      files: document.querySelector('.evidence-passage__actions a[href*="/files"]')?.getAttribute('href') ?? '',
      original: document.querySelector('.evidence-passage__actions a[target="_blank"]')?.getAttribute('href') ?? '',
      width: Math.round(document.querySelector('.evidence-drawer')?.getBoundingClientRect().width ?? 0),
    }));
    if (!d.text) fail('drawer: empty passage text');
    if (!d.file) fail('drawer: no file name');
    if (!d.title) fail('drawer: no title');
    if (!/\/files\?document=.+&passage=.+/.test(d.files)) fail(`drawer: Open in Files links to "${d.files}"`);
    if (!/\/barghest\/file\?documentId=/.test(d.original)) fail(`drawer: Open original links to "${d.original}"`);
    else {
      const res = await fetch(new URL(d.original, ORIGIN)).catch(() => null);
      if (!res?.ok) console.log(`smoke-profile: ${tag} note: the stored original answers ${res?.status ?? 'nothing'} (seed files have no stored copy)`);
    }
    const caps = await capsOk();
    if (caps.bad.length) fail(`caps headings not D-DIN Bold: ${caps.bad.join(', ')}`);
    const tiny = await small();
    if (tiny.length) fail(`text under 14px: ${[...new Set(tiny)].slice(0, 6).join('; ')}`);
    if (!(await noScroll())) fail('drawer: the document scrolls');
    await page.screenshot({ path: join(shots, `drawer-${tag}.png`) });
    console.log(`smoke-profile: ${tag} drawer "${d.title}", ${d.width}px, file ${d.file}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    if (await page.locator('.evidence-drawer').count()) fail('drawer: Escape did not close it');
  }

  // 3. Beside the Object Explorer's list.
  await page.goto(listed, { waitUntil: 'load' });
  await page.locator('.result-list .result-item').first().waitFor({ timeout: 15000 }).catch(() => fail('list: no result list'));
  await page.locator('.profile-head h4').waitFor({ timeout: 15000 }).catch(() => fail('list: no profile beside the list'));
  const besideTitle = await page.locator('.profile-head h4').textContent().catch(() => '');
  if (besideTitle !== person.title) fail(`list: profile names "${besideTitle}"`);
  if (await page.locator('.profile-back').count()) fail('list: a Back shows beside the list');
  const besideSecs = await sections();
  if (besideSecs.length !== SECTIONS.length) fail(`list: ${besideSecs.length} sections`);
  if (!(await noScroll())) fail('list: the document scrolls');
  await page.screenshot({ path: join(shots, `list-${tag}.png`) });
  const besideColumns = new Set(besideSecs.map((s) => s.x)).size;

  // 4. A link to an object that isn't there.
  await page.goto(missing, { waitUntil: 'load' });
  await page.getByText("This object isn't here").waitFor({ timeout: 15000 }).catch(() => fail('missing: no not-found state'));
  await page.screenshot({ path: join(shots, `missing-${tag}.png`) });

  console.log(`smoke-profile: ${tag} ${secs.length} sections, ${columns} column(s) on its own, ${besideColumns} beside the list`);
  if (errors.length) fail(`console errors: ${errors.slice(0, 5).join(' | ')}`);
  await page.close();
}

await run(1440, 900);
await run(1920, 1080);
await browser.close();

if (failures.length) {
  console.error(`smoke-profile: FAIL\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`smoke-profile: PASS, screenshots in dist-shots/profile/`);
