// BARGHEST Timeline smoke: prove S5 in headless Chromium against a running dev server (5183 by default,
// BARGHEST_DEV_PORT to change it) and the engine on 8787, at 1440 x 900 and 1920 x 1080. The subject is found by
// query, never by id: the Person with the most dated events within two hops. Timelines are files: the smoke makes its
// own through the engine, works in it, and deletes it, then checks the engine holds nothing it made. Checks: the home
// lists the investigation's timelines and opens one; events listed in the engine's time order; the histogram has bars;
// a bar click filters the list to that bin; a drag across bars zooms in and Reset zooms out, both saved into the file;
// the hops switch asks again and saves; a second object adds to the file; a flagged system Relationship (the deletion
// gap) shows as a band and a warning row whenever the data holds one; a link naming an object opens that object's own
// file; rename and delete from the home; all-caps headings in D-DIN Bold; no text under 14px; the document never
// scrolls; zero console errors. Screenshots to dist-shots/timeline/. Exit 1 on any failure.
// Run: node scripts/smoke-timeline.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(app, 'dist-shots', 'timeline');
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
  console.error(`smoke-timeline: the engine is not answering at ${ENGINE}`);
  process.exit(1);
}
const rid = health.ontology.rid;
const persons = await fetch(`${ENGINE}/api/v2/ontologies/${rid}/objects/Person?pageSize=1000`, { headers: AUTH })
  .then((r) => r.json())
  .then((b) => b.data ?? []);
const timelineOf = (objectId, hops) => fetch(`${ENGINE}/barghest/timeline?${new URLSearchParams({ objectId, hops: String(hops) })}`).then((r) => r.json());

// ---- The subject, by query: the Person with the most dated events within two hops ----
let best = null;
for (const p of persons.filter((p) => !p.canonicalId)) {
  const t = await timelineOf(`Person:${p.__primaryKey}`, 2);
  if (!best || t.events.length > best.timeline.events.length) best = { person: p, timeline: t };
}
if (!best?.timeline.events.length) {
  console.error('smoke-timeline: no Person has a dated event within two hops');
  process.exit(1);
}
const subject = `Person:${best.person.__primaryKey}`;
const events = best.timeline.events;
const flagged = events.filter((e) => e.tag === 'system' && e.id.startsWith('Relationship:'));
const investigation = best.person.scenario ?? (await fetch(`${ENGINE}/barghest/investigations`).then((r) => r.json())).investigations[0].id;
console.log(`subject ${subject} (${best.person.__title}), ${events.length} events within 2 hops, ${flagged.length} flagged`);
const other = persons.find((p) => !p.canonicalId && p.scenario === best.person.scenario && `Person:${p.__primaryKey}` !== subject && p.__title !== best.person.__title);

// ---- Saved timelines: what was there before, so only what the smoke makes is removed ----
const saved = {
  list: () => fetch(`${ENGINE}/barghest/saved?${new URLSearchParams({ investigation, kind: 'timeline' })}`).then((r) => r.json()).then((b) => b.items ?? []),
  get: (id) => fetch(`${ENGINE}/barghest/saved-item?${new URLSearchParams({ id })}`).then((r) => (r.ok ? r.json() : null)),
  post: (path, body) => fetch(`${ENGINE}/barghest/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()),
};
const existing = new Set((await saved.list()).map((i) => i.id));
// When the subject already has its own file, it belongs to someone; the link test leaves it alone.
const taken = (await Promise.all([...existing].map(saved.get))).some((i) => i?.body?.origin === subject);
const made = [];
const stamp = `Smoke timeline ${Date.now().toString(36)}`;
const savedNow = (page) => page.locator('.file-status', { hasText: /^Saved$/ }).waitFor({ timeout: 8000 }).catch(() => {});
const bodyOf = async (id) => (await saved.get(id))?.body ?? {};

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
      if (!cs.fontFamily.replace(/['"]/g, '').startsWith('D-DIN')) bad.push(`${el.textContent}: ${cs.fontFamily}`);
      if (cs.fontWeight !== '700' || cs.textTransform !== 'uppercase' || cs.fontSize !== '14px') bad.push(`${el.textContent}: ${cs.fontWeight} ${cs.textTransform} ${cs.fontSize}`);
    }
    const loaded = [...document.fonts].some((f) => f.family.replace(/['"]/g, '') === 'D-DIN' && f.weight === '700' && f.status === 'loaded');
    return { count: heads.length, bad, loaded };
  }, scope);

const noScroll = (page) => page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight && document.scrollingElement.scrollWidth <= innerWidth && scrollY === 0);
const rowCount = (page) => page.locator('.timeline-table .timeline-row').count();
const hasSaved = (page) => page.waitForFunction(() => new URL(location.href).searchParams.has('saved'), null, { timeout: 8000 }).catch(() => {});

try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    const tag = `${viewport.width}x${viewport.height}`;
    const { page, errors } = await open(viewport);

    // The home lists this investigation's timelines; a click opens one.
    const mine = await saved.post('saved', { investigation, kind: 'timeline', name: `${stamp} ${tag}`, body: { subjects: [subject], hops: 2 } });
    made.push(mine.id);
    await page.goto(`${BASE}/${investigation}/timeline`);
    const row = page.locator('.home-table__row', { hasText: mine.name });
    await row.waitFor({ timeout: 8000 }).catch(() => {});
    check(await row.isVisible().catch(() => false), `${tag}: the home lists this investigation's timelines, "${mine.name}" among them`);
    check(await page.getByText('All timelines', { exact: true }).first().isVisible().catch(() => false), `${tag}: the menu bar says "All timelines" on the home`);
    await row.getByText(best.person.__title).first().waitFor({ timeout: 8000 }).catch(() => {});
    check(((await row.textContent()) ?? '').includes(best.person.__title), `${tag}: the row names its subject, "${best.person.__title}"`);
    await page.screenshot({ path: join(shots, `${tag}-0-home.png`) });
    const homeSmall = await textSizes(page, '.home');
    check(!homeSmall.length, `${tag}: no text under 14px on the home${homeSmall.length ? ` (${homeSmall.slice(0, 4).join('; ')})` : ''}`);
    await row.click();
    await hasSaved(page);
    check(new URL(page.url()).searchParams.get('saved') === mine.id, `${tag}: a row opens its timeline at ?saved=${mine.id}`);
    await page.locator('.timeline-table .timeline-row').first().waitFor({ timeout: 15000 }).catch(() => {});

    // Events in the engine's order.
    const shown = await page.locator('.timeline-table .timeline-row__event').evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ''));
    check(shown.length === events.length, `${tag}: every event is listed (${shown.length} of ${events.length})`);
    check(shown.every((s, i) => s === events[i].summary.trim()), `${tag}: events in time order, first "${shown[0]}", last "${shown[shown.length - 1]}"`);
    const chip = page.locator('.timeline__chip strong:not(.bp6-skeleton)', { hasText: best.person.__title });
    await chip.first().waitFor({ timeout: 10000 }).catch(() => {});
    check(await chip.first().isVisible().catch(() => false), `${tag}: the subject shows by name, "${best.person.__title}"`);

    // The histogram has bars.
    const segs = await page.locator('.timeline-bin__seg').count();
    check(segs > 0, `${tag}: the histogram has bars (${segs} segments)`);
    // Each tag's word and bar wear its palette colour: text the -5 shade, bars the -3.
    const paint = await page.evaluate(() => {
      const probe = document.createElement('span');
      document.body.append(probe);
      const as = (prop, value) => {
        probe.style[prop] = value;
        return getComputedStyle(probe)[prop];
      };
      const want = { observed: 'blue', system: 'orange', analyst: 'violet' };
      const bad = [];
      for (const [t, hue] of Object.entries(want)) {
        const word = document.querySelector(`.timeline-row .timeline-tag--${t}`);
        if (word && getComputedStyle(word).color !== as('color', `var(--bp-palette-${hue}-5)`)) bad.push(`${t} text ${getComputedStyle(word).color}`);
        const bar = document.querySelector(`.timeline-bin__seg.timeline-swatch--${t}`);
        if (bar && getComputedStyle(bar).backgroundColor !== as('backgroundColor', `var(--bp-palette-${hue}-3)`)) bad.push(`${t} bar ${getComputedStyle(bar).backgroundColor}`);
      }
      probe.remove();
      return bad;
    });
    check(!paint.length, `${tag}: tag words in the -5 shade and bars in the -3 shade of blue, orange and violet${paint.length ? ` (${paint.join('; ')})` : ''}`);
    await page.screenshot({ path: join(shots, `${tag}-1-all.png`) });

    // A bar click filters the list to its bin.
    const filled = page.locator('.timeline-bin:has(.timeline-bin__seg)');
    await filled.first().click();
    const filterText = (await page.locator('.timeline__filter').textContent()) ?? '';
    const n = Number(/(\d+) events?/.exec(filterText)?.[1] ?? -1);
    check(n > 0 && (await rowCount(page)) === n && (await page.locator('.timeline-bin--picked').count()) === 1, `${tag}: a bar click filters the list ("${filterText.replace('Clear', '').trim()}")`);
    await page.screenshot({ path: join(shots, `${tag}-2-bin.png`) });
    await page.locator('.timeline__filter').getByRole('button', { name: 'Clear' }).click();

    // A row opens its event in the panel beside the table.
    await page.locator('.timeline-table .timeline-row').first().click();
    check(((await page.locator('.timeline-panel__summary').textContent().catch(() => '')) ?? '').trim() === events[0].summary.trim(), `${tag}: a row opens its event in the panel, "${events[0].summary}"`);

    // A drag across bars zooms in; Reset zooms out. Both are saved into the file.
    const bins = page.locator('.timeline-bin');
    const count = await bins.count();
    if (count > 2) {
      const a = await bins.nth(0).boundingBox();
      const b = await bins.nth(Math.max(1, Math.floor(count / 2))).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
      await page.mouse.up();
      await savedNow(page);
      const zoom = await bodyOf(mine.id);
      check(!!zoom.from && !!zoom.until && (await page.getByRole('button', { name: 'Reset zoom' }).isVisible()), `${tag}: a drag across bars zooms in, saved into the file (${zoom.from} to ${zoom.until})`);
      await page.screenshot({ path: join(shots, `${tag}-3-zoomed.png`) });
      await page.getByRole('button', { name: 'Reset zoom' }).click();
      await savedNow(page);
      check(!(await bodyOf(mine.id)).from && (await rowCount(page)) === events.length, `${tag}: Reset shows every event again`);
    } else {
      check(true, `${tag}: drag to zoom skipped, only ${count} bins`);
    }

    // The hops switch asks again, and saves.
    const one = await timelineOf(subject, 1);
    await page.getByRole('radio', { name: '1' }).click().catch(async () => page.locator('.bp6-segmented-control button', { hasText: '1' }).click());
    await page.waitForFunction((want) => document.querySelectorAll('.timeline-table .timeline-row').length === want, one.events.length, { timeout: 8000 }).catch(() => {});
    await savedNow(page);
    check((await bodyOf(mine.id)).hops === 1 && (await rowCount(page)) === one.events.length, `${tag}: hops 1 lists ${one.events.length} events, saved into the file`);

    // A second object adds to the file.
    if (other) {
      await page.getByPlaceholder('Add an object to this timeline').fill(other.__title);
      await page.locator('.graph-search__menu .bp6-menu-item', { hasText: other.__title }).first().click({ timeout: 8000 }).catch(() => {});
      await savedNow(page);
      const subjects = (await bodyOf(mine.id)).subjects ?? [];
      check((await page.locator('.timeline__chip').count()) === 2 && subjects.length === 2, `${tag}: "${other.__title}" adds to the timeline (${subjects.length} subjects stored)`);
      await page.screenshot({ path: join(shots, `${tag}-4-two.png`) });
    }

    // The deletion gap: a band and a warning row, whenever the data holds a flagged Relationship.
    await savedNow(page);
    await saved.post('update-saved', { id: mine.id, body: { subjects: [subject], hops: 2 } });
    await page.reload();
    await page.locator('.timeline-table .timeline-row').first().waitFor({ timeout: 15000 }).catch(() => {});
    if (flagged.length) {
      check((await page.locator('.timeline-row--flag').count()) === flagged.length && (await page.locator('.timeline-bin--flagged').count()) > 0, `${tag}: the deletion gap shows as a band and ${flagged.length} warning row(s)`);
    } else {
      console.log(`note  ${tag}: no flagged system Relationship within 2 hops of the subject`);
    }

    const caps = await capsHeadings(page, '.timeline');
    check(caps.count > 0 && !caps.bad.length && caps.loaded, `${tag}: all-caps headings in D-DIN Bold 14px (${caps.count} checked${caps.bad.length ? `; ${caps.bad.join('; ')}` : ''}${caps.loaded ? '' : '; D-DIN Bold not loaded'})`);
    const small = await textSizes(page, '.timeline');
    check(!small.length, `${tag}: no text under 14px${small.length ? ` (${small.slice(0, 4).join('; ')})` : ''}`);
    check(await noScroll(page), `${tag}: the document never scrolls`);

    // A link from another view that names an object opens that object's own file, made the first time.
    if (viewport.width === 1440) {
      if (taken) console.log(`note  ${tag}: ${subject} already has its own timeline; the link test leaves it alone`);
      else {
        await page.goto(`${BASE}/${investigation}/timeline?${new URLSearchParams({ object: subject })}`);
        await hasSaved(page);
        const id = new URL(page.url()).searchParams.get('saved');
        if (id && !existing.has(id)) made.push(id);
        const linked = id ? await saved.get(id) : null;
        check(!!linked && linked.body?.origin === subject && linked.name === best.person.__title, `${tag}: ?object= opens the object's own timeline, named "${linked?.name}"`);
        await page.locator('.timeline-table .timeline-row').first().waitFor({ timeout: 15000 }).catch(() => {});
      }
    }

    // Rename and delete from the home's row menu.
    await page.goto(`${BASE}/${investigation}/timeline`);
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

console.log(failures.length ? `\nsmoke-timeline: ${failures.length} failed` : '\nsmoke-timeline: all passed');
process.exit(failures.length ? 1 : 0);
