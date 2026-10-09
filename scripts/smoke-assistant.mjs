// BARGHEST Assistant smoke (S6), proved in a real browser against Builder 4's dev server (5184;
// BARGHEST_ASSISTANT_ORIGIN moves it) and the running engine (8787; BARGHEST_ENGINE_PORT), with the local model OFF:
// the smoke refuses to run if the engine has the model on, so it never starts a model call. At 1440 x 900 and
// 1920 x 1080: `?q=` fills the input and sends nothing; the empty conversation shows example questions; the model-off
// callout shows; Ask returns the keyword records as numbered citations under "Found by keyword", never as an answer;
// the conversation is named by its question; the model switcher lists this Mac first and Online second; a citation
// opens Files at its passage; all-caps headings in D-DIN Bold; nothing under 14px; the document never scrolls; zero
// console errors. Read-only: with the model off, ask writes nothing. Screenshots to dist-shots/assistant/. Exit 1 on
// any failure.
// Run: node scripts/smoke-assistant.mjs   (with `pnpm exec vite --port 5184 --strictPort` running)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(app, 'dist-shots', 'assistant');
const ORIGIN = process.env.BARGHEST_ASSISTANT_ORIGIN ?? 'http://localhost:5184';
const ENGINE = `http://127.0.0.1:${process.env.BARGHEST_ENGINE_PORT ?? 8787}`;
const LABEL_FACE = 'D-DIN';

const health = await fetch(`${ENGINE}/barghest/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error(`smoke-assistant: the engine is not answering on ${ENGINE}`);
  process.exit(1);
}
if (health.ollama !== null) {
  console.error('smoke-assistant: the engine has the local model on; this smoke only asks with the model off');
  process.exit(1);
}
const appUp = await fetch(ORIGIN).then((r) => r.ok).catch(() => false);
if (!appUp) {
  console.error(`smoke-assistant: no app on ${ORIGIN}; start it with pnpm exec vite --port 5184 --strictPort`);
  process.exit(1);
}

// The question, by query: the person with the most source spellings, else the most links out.
const { connect } = await import('../src/data/client.ts');
const { fetchRows, histogram } = await import('../src/data/reads.ts');
const dc = await connect(ENGINE);
let subject = null;
for (const [start, steps, property] of [
  ['Person', [], 'canonicalId'],
  ['Relationship', [{ filter: { property: 'fromType', op: 'eq', value: 'Person' } }], 'fromId'],
]) {
  const h = await histogram(dc, { start, steps }, property).catch(() => null);
  const top = h?.buckets.find((b) => b.bucket && b.bucket !== '(empty)' && b.count > 0);
  if (top) {
    subject = top.bucket;
    break;
  }
}
if (!subject) {
  console.error('smoke-assistant: no Person has candidates or links; nothing to ask about');
  process.exit(1);
}
const person = (await fetchRows(dc, { start: 'Person', steps: [{ filter: { property: 'personId', op: 'eq', value: subject } }], pageSize: 1 })).rows[0];
const investigation = String(person.properties.scenario);
const question = `What connects ${person.title} to the incident?`;
console.log(`smoke-assistant: asking "${question}" in ${investigation}`);

mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const failures = [];

async function run(width, height) {
  const tag = `${width}x${height}`;
  const fail = (m) => failures.push(`${tag}: ${m}`);
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const noScroll = () => page.evaluate(() => { const d = document.scrollingElement; return d.scrollHeight <= innerHeight && d.scrollWidth <= innerWidth; });
  const capsBad = () =>
    page.evaluate((face) => {
      const heads = [...document.querySelectorAll('.assistant .caps-heading, .assistant-conversation__title h4, .assistant-models .caps-heading')];
      return heads
        .filter((h) => { const s = getComputedStyle(h); return !(s.fontFamily.replace(/["']/g, '').startsWith(face) && s.fontWeight === '700' && s.textTransform === 'uppercase'); })
        .map((h) => `"${h.textContent}" ${getComputedStyle(h).fontFamily} ${getComputedStyle(h).fontWeight}`);
    }, LABEL_FACE);
  const tiny = () =>
    page.evaluate(() => [...document.querySelectorAll('.assistant *, .assistant-models *')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14)
      .map((el) => `${el.className || el.tagName} ${getComputedStyle(el).fontSize}`));

  // ?q= fills the input and sends nothing.
  await page.goto(`${ORIGIN}/${investigation}/assistant?${new URLSearchParams({ q: question })}`);
  const input = page.getByRole('textbox', { name: 'Question' });
  await input.waitFor({ timeout: 15000 });
  if ((await input.inputValue()) !== question) fail('?q= did not fill the input');
  await page.waitForTimeout(500);
  if (await page.locator('.assistant-turn').count()) fail('?q= sent the question on its own');

  // The empty conversation: examples and the model-off callout.
  await page.locator('.assistant-examples .bp6-button').first().waitFor({ timeout: 15000 }).catch(() => fail('no example questions'));
  const examples = await page.locator('.assistant-examples .bp6-button').allInnerTexts();
  const off = await page.locator('.assistant-off').innerText().catch(() => '');
  if (!off.includes('The local model is off')) fail('the model-off callout is missing');
  const offBox = await page.evaluate(() => {
    const c = document.querySelector('.assistant-off')?.getBoundingClientRect();
    const panel = document.querySelector('.assistant-conversation')?.getBoundingClientRect();
    const thread = document.querySelector('.assistant-conversation__thread')?.getBoundingClientRect();
    return c && panel && thread ? { inside: c.left >= panel.left && c.right <= panel.right, above: c.bottom <= thread.top + 1 } : null;
  });
  if (!offBox?.inside || !offBox?.above) fail(`the model-off callout is not under the header inside the panel: ${JSON.stringify(offBox)}`);
  const exampleRows = await page.evaluate(() => new Set([...document.querySelectorAll('.assistant-examples .bp6-button')].map((b) => Math.round(b.getBoundingClientRect().top))).size);
  if (exampleRows > 1 && (await page.evaluate(() => innerWidth)) >= 1440) fail(`the example questions wrap onto ${exampleRows} rows`);
  if (!(await noScroll())) fail('empty: the document scrolls');
  await page.screenshot({ path: join(shots, `${tag}-empty.png`) });

  // Ask: the keyword records come back as citations, never as an answer.
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const turn = page.locator('.assistant-turn').first();
  await turn.locator('.assistant-turn__body, .bp6-callout').first().waitFor({ timeout: 20000 });
  const cites = turn.locator('.assistant-cite');
  const nCites = await cites.count();
  if (!nCites) fail(`no keyword citations came back: ${(await turn.innerText()).slice(0, 160)}`);
  const turnText = await turn.innerText();
  if (!/FOUND BY KEYWORD/i.test(turnText)) fail('citations are not headed "Found by keyword"');
  if (!turnText.includes('No answer. Searched for:')) fail('the model-off reply does not say it is not an answer');
  if (/Answered on this machine/.test(turnText)) fail('a model-off reply claims an answer');
  for (let i = 0; i < nCites; i++) {
    const t = await cites.nth(i).innerText();
    if (!t.includes('Keyword match')) fail(`citation ${i + 1} is not tagged "Keyword match"`);
    if (t.replace(/Keyword match|\d/g, '').trim().length < 20) fail(`citation ${i + 1} shows no quote`);
  }
  const row = await page.locator('.assistant-list__row').innerText().catch(() => '');
  if (!row.includes(question)) fail('the conversation is not named by its first question');
  if ((await input.inputValue()) !== '') fail('the input was not cleared after Ask');
  if (!(await noScroll())) fail('answered: the document scrolls');
  await page.screenshot({ path: join(shots, `${tag}-keyword.png`) });

  // The model switcher: this Mac first, Online second.
  await page.locator('.assistant-composer__model').click();
  const menu = page.locator('.assistant-models');
  await menu.waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  const menuText = await menu.innerText();
  const mac = menuText.toUpperCase().indexOf('ON THIS MAC');
  const online = menuText.toUpperCase().indexOf('ONLINE');
  if (mac < 0 || online < 0 || mac > online) fail(`switcher menu order wrong: ${menuText.replace(/\n/g, ' / ')}`);
  const caps = await capsBad();
  if (caps.length) fail(`caps headings not D-DIN Bold: ${caps.join(', ')}`);
  const small = await tiny();
  if (small.length) fail(`text under 14px: ${[...new Set(small)].slice(0, 6).join('; ')}`);
  await page.screenshot({ path: join(shots, `${tag}-switcher.png`) });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Conversations: the first is named by its question and opens in the address bar; Rename from the right-click menu
  // renames the row and the menu bar; a second conversation lists first; a row reopens its own; Delete from "…" asks.
  const rows = page.locator('.assistant-list__row');
  const firstSaved = new URL(page.url()).searchParams.get('saved');
  if (!firstSaved) fail('the first question did not put its conversation in the address bar (?saved=)');
  const renamed = `${person.title} and the incident`;
  await rows.first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const nameBox = page.getByRole('textbox', { name: 'Conversation name' });
  await nameBox.fill(renamed);
  await nameBox.press('Enter');
  await page.waitForTimeout(200);
  if (!(await rows.first().innerText()).includes(renamed)) fail('Rename did not rename the row');
  if (!(await page.locator('.menubar__title').innerText()).includes(renamed)) fail('the menu bar does not name the renamed conversation');
  await page.getByRole('button', { name: 'New conversation' }).click();
  await page.locator('.assistant-examples .bp6-button').nth(1).click();
  const second = await input.inputValue();
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.locator('.assistant-turn .assistant-turn__body, .assistant-turn .bp6-callout').first().waitFor({ timeout: 20000 });
  if ((await rows.count()) !== 2) fail(`expected 2 conversations, the list holds ${await rows.count()}`);
  if (!(await rows.first().innerText()).includes(second)) fail('the newest conversation is not listed first');
  await page.screenshot({ path: join(shots, `${tag}-two.png`) });
  await rows.nth(1).locator('.assistant-list__open').click();
  await page.waitForTimeout(200);
  if (new URL(page.url()).searchParams.get('saved') !== firstSaved) fail('clicking a row did not open its conversation');
  if (!(await page.locator('.assistant-turn').first().innerText()).includes(question)) fail('the reopened conversation does not show its question');
  await rows.first().hover();
  await rows.first().locator('.assistant-list__more').click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const alert = page.locator('.bp6-alert');
  await alert.waitFor({ timeout: 5000 });
  if (!(await alert.innerText()).includes(second)) fail('the delete prompt does not name the conversation');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, `${tag}-delete.png`) });
  await alert.getByRole('button', { name: 'Delete' }).click();
  await page.waitForTimeout(400);
  if ((await rows.count()) !== 1) fail(`Delete left ${await rows.count()} conversations`);

  // A citation opens Files at its passage.
  if (nCites) {
    const href = await cites.first().getAttribute('href');
    if (!href) fail('the first citation has no link');
    else {
      await cites.first().click();
      await page.waitForURL(/\/files\?/, { timeout: 5000 }).catch(() => {});
      const url = new URL(page.url());
      if (!url.pathname.endsWith('/files') || !url.searchParams.get('document') || !url.searchParams.get('passage')) fail(`a citation landed on ${url.pathname}${url.search}`);
    }
  }

  if (errors.length) fail(`console errors: ${errors.slice(0, 5).join(' | ')}`);
  console.log(`smoke-assistant: ${tag} ${examples.length} example(s), ${nCites} keyword citation(s)`);
  await page.close();
}

await run(1440, 900);
await run(1920, 1080);
await browser.close();

if (failures.length) {
  console.error(`smoke-assistant: FAIL\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('smoke-assistant: PASS, screenshots in dist-shots/assistant/');
