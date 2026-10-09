// BARGHEST photos smoke, proved in a real browser against Builder 4's dev server (5184; BARGHEST_PHOTOS_ORIGIN moves
// it) and the running engine (8787; BARGHEST_ENGINE_PORT). A photo is never read by the model (engine-api.md 2.11), so
// this runs with the model on or off; it asks no question. At 1440 x 900 and 1920 x 1080: a plain test JPEG (grey
// lockers, no face) stamped with a date, a place and a camera is imported; Files shows its picture in its row and
// "Photo, details read"; opened, the picture draws with its details and no "Run the model again"; Link to… finds the
// subject by name and links it; the subject's profile shows the photo in its header and its Photos card; a click opens
// it large; Unlink from the card drops the link in the engine and the header falls back to the type icon; the photo is
// deleted and the engine no longer has it. All-caps headings in D-DIN Bold, nothing under 14px, the document never
// scrolls, zero console errors. Screenshots to dist-shots/photos/. Exit 1 on any failure.
// Run: node scripts/smoke-photos.mjs   (with `pnpm exec vite --port 5184 --strictPort` running)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(app, 'dist-shots', 'photos');
const ORIGIN = process.env.BARGHEST_PHOTOS_ORIGIN ?? 'http://localhost:5184';
const ENGINE = `http://127.0.0.1:${process.env.BARGHEST_ENGINE_PORT ?? 8787}`;
const LABEL_FACE = 'D-DIN';

const health = await fetch(`${ENGINE}/barghest/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error(`smoke-photos: the engine is not answering on ${ENGINE}`);
  process.exit(1);
}
if (!health.formats?.includes('jpg')) {
  console.error('smoke-photos: the engine does not take photos yet (health.formats has no jpg)');
  process.exit(1);
}
const appUp = await fetch(ORIGIN).then((r) => r.ok).catch(() => false);
if (!appUp) {
  console.error(`smoke-photos: no app on ${ORIGIN}; start it with pnpm exec vite --port 5184 --strictPort`);
  process.exit(1);
}

const { connect } = await import('../src/data/client.ts');
const { fetchRows, getObjectView, histogram } = await import('../src/data/reads.ts');
const { deleteDocument, getDocumentView, importFile } = await import('../src/data/intake.ts');
const { stampJpeg, writeExif } = await import('../engine/ingest/photo.mjs');
const dc = await connect(ENGINE);

// The subject, by query: the resolved person with the most links out, with no picture of their own yet.
const links = await histogram(dc, { start: 'Relationship', steps: [{ filter: { property: 'fromType', op: 'eq', value: 'Person' } }] }, 'fromId');
let person = null;
for (const b of links.buckets.filter((b) => b.bucket && b.bucket !== '(empty)')) {
  const row = (await fetchRows(dc, { start: 'Person', steps: [{ filter: { property: 'personId', op: 'eq', value: b.bucket } }], pageSize: 1 })).rows[0];
  if (row && !row.properties.canonicalId && !row.properties.photoId) {
    person = row;
    break;
  }
}
if (!person) {
  console.error('smoke-photos: no resolved person without a picture to link a test photo to');
  process.exit(1);
}
const investigation = String(person.properties.scenario);
const objectKey = `Person:${person.pk}`;
const word = person.title.split(/[\s,]+/).find((w) => w.length >= 3) ?? person.title;
console.log(`smoke-photos: linking a test photo to ${person.title} in ${investigation}`);

mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const failures = [];

// A plain test picture: grey lockers on a dark wall, no face; the date, place and camera written into it.
const maker = await browser.newPage({ viewport: { width: 640, height: 480 } });
await maker.setContent(
  '<body style="margin:0;background:#2b3038">' +
    [80, 250, 420].map((x, i) => `<div style="position:absolute;left:${x}px;top:90px;width:140px;height:300px;background:${i === 1 ? '#abb3bf' : '#8f99a8'}"></div>`).join('') +
    '</body>',
);
const META = { takenAt: '2026-09-14T09:20:00+08:00', latitude: 14.5995, longitude: 120.9842, cameraMake: 'Apple', cameraModel: 'iPhone 13', orientation: 1, width: 640, height: 480 };
const BYTES = stampJpeg(await maker.screenshot({ type: 'jpeg', quality: 80 }), writeExif(META));
await maker.close();

async function run(width, height) {
  const tag = `${width}x${height}`;
  const fail = (m) => failures.push(`${tag}: ${m}`);
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const noScroll = () => page.evaluate(() => { const d = document.scrollingElement; return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth; });
  const capsBad = () =>
    page.evaluate((face) => [...document.querySelectorAll('.photo-card .caps-heading, .photos-section .caps-heading')]
      .filter((h) => { const s = getComputedStyle(h); return !(s.fontFamily.replace(/["']/g, '').startsWith(face) && s.fontWeight === '700' && s.textTransform === 'uppercase'); })
      .map((h) => `"${h.textContent}" ${getComputedStyle(h).fontFamily} ${getComputedStyle(h).fontWeight}`), LABEL_FACE);
  const tiny = () =>
    page.evaluate(() => [...document.querySelectorAll('.photo-file *, .photos-section *, .photos-dialog *, .photo-link-to *')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14)
      .map((el) => `${el.className || el.tagName} ${getComputedStyle(el).fontSize}`));

  const name = `smoke-photo-${tag}-${Date.now().toString(36)}.jpg`;
  const made = await importFile(dc, { file: new File([BYTES], name, { type: 'image/jpeg' }), investigation, extract: false });
  const doc = made.documentId;
  try {
    if (made.status !== 'photo' || made.extraction !== 'photo') fail(`the import is not a photo: ${made.status}, ${made.extraction}`);

    // Files: the photo's row shows its picture and its status.
    await page.goto(`${ORIGIN}/${investigation}/files`);
    const row = page.getByText(name, { exact: true }).first();
    await row.waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    const rowBox = page.locator('tr', { has: page.getByText(name, { exact: true }) }).first();
    if (!(await rowBox.locator('img.photo-thumb').evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false))) fail('Files: the row does not draw the picture');
    if (!(await rowBox.innerText()).includes('Photo, details read')) fail('Files: the row does not say "Photo, details read"');
    await page.screenshot({ path: join(shots, `${tag}-files.png`) });

    // The photo, opened: picture, details, nothing to run the model on.
    await row.dblclick();
    await page.locator('.photo-file .photo-view img').waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    if (!(await page.locator('.photo-file .photo-view img').evaluate((i) => i.naturalWidth > 0))) fail('open: the picture does not draw');
    const facts = await page.locator('.photo-facts').innerText();
    for (const want of ['14 Sep 2026, 09:20', '14.5995, 120.9842', 'Apple iPhone 13', '640 x 480']) if (!facts.includes(want)) fail(`open: details lack ${want}: ${facts.replace(/\n/g, ' | ')}`);
    if (await page.getByRole('button', { name: 'Run the model again' }).count()) fail('open: a photo offers "Run the model again"');
    if (!(await noScroll())) fail('open: the document scrolls');

    // Link to…, by a word of the subject's name.
    await page.getByRole('button', { name: 'Link to…' }).click();
    await page.getByRole('textbox', { name: 'Search this investigation’s objects' }).fill(word);
    const option = page.locator('.photo-link-to__results .bp6-menu-item').filter({ has: page.getByText(person.title, { exact: true }) }).first();
    await option.waitFor({ timeout: 15000 }).catch(() => fail(`Link to…: ${person.title} is not found by "${word}"`));
    await page.screenshot({ path: join(shots, `${tag}-link-to.png`) });
    if (await option.count()) await option.click();
    await page.locator('.photo-shows__row').first().waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    const shows = await page.locator('.photo-shows').innerText();
    if (!shows.includes(person.title) || !shows.includes('Their photo')) fail(`Shows: ${shows.replace(/\n/g, ' | ')}`);
    let view = await getObjectView(dc, 'Person', person.pk);
    if (view.photo?.documentId !== doc) fail('engine: the subject\'s picture is not the photo');
    const caps1 = await capsBad();
    if (caps1.length) fail(`caps headings not D-DIN Bold: ${caps1.join(', ')}`);
    const small1 = await tiny();
    if (small1.length) fail(`text under 14px: ${[...new Set(small1)].slice(0, 6).join('; ')}`);
    await page.screenshot({ path: join(shots, `${tag}-open.png`) });

    // The profile: the photo in the header and in Photos; a click opens it large.
    await page.goto(`${ORIGIN}/${investigation}/browser?${new URLSearchParams({ object: objectKey })}`);
    await page.locator('.photos-tile').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    if (!(await page.locator('.profile-head .photo-picture').count())) fail('profile: the header does not show the photo');
    if (!(await page.locator('.photos-tile').first().innerText()).includes('Their photo')) fail('profile: the photo is not tagged "Their photo"');
    if (!(await noScroll())) fail('profile: the document scrolls');
    await page.screenshot({ path: join(shots, `${tag}-profile.png`) });
    await page.locator('.photos-tile__open').first().click();
    await page.locator('.photos-dialog').waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
    if (!(await page.locator('.photos-dialog').innerText()).includes('Apple iPhone 13')) fail('large: the dialog does not show the details');
    const small2 = await tiny();
    if (small2.length) fail(`text under 14px: ${[...new Set(small2)].slice(0, 6).join('; ')}`);
    await page.screenshot({ path: join(shots, `${tag}-large.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Unlink from the card's menu: the engine drops the link and the header falls back to the type icon.
    await page.locator('.photos-tile').first().hover();
    await page.locator('.photos-tile__more').first().click();
    await page.getByRole('menuitem', { name: 'Unlink' }).click();
    await page.waitForTimeout(1200);
    view = await getObjectView(dc, 'Person', person.pk);
    if (view.images.some((i) => i.documentId === doc) || view.photo?.documentId === doc) fail('Unlink: the engine still links the photo');
    if (await page.locator('.profile-head .photo-picture').count()) fail('Unlink: the header still shows the photo');
    if (errors.length) fail(`console errors: ${errors.slice(0, 5).join(' | ')}`);
  } finally {
    await deleteDocument(dc, doc).catch(() => {});
    if (!(await getDocumentView(dc, doc).then(() => false, (e) => e.status === 404))) fail('Delete: the engine still has the photo');
    await page.close();
  }
  console.log(`smoke-photos: ${tag} done`);
}

await run(1440, 900);
await run(1920, 1080);
await browser.close();

if (failures.length) {
  console.error(`smoke-photos: FAIL\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('smoke-photos: PASS, screenshots in dist-shots/photos/');
