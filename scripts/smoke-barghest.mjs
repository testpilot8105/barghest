// BARGHEST smoke: serve dist/ and prove the shell, not describe it. At 1440 x 900 and again at 1920 x 1080: bp6-dark
// on body; the owner's palette (Graphite: chrome dark gray 1, main dark gray 2; each rail icon in its own colour, kept
// when open, on one grey highlight for every view); D-DIN loaded and used on labels, Source
// Sans 3 on running text; nothing under 14px; the owner's Figma version (the dog and BARGHEST in D-DIN then search
// across the app bar, the toggle on top of the rail, 4px between rail icons); rail labels not repainted link-blue;
// the rail at its collapsed width with a tooltip, then expanded; the URL drives the view (click, back); the document
// never scrolls; zero console errors. Screenshots to dist-shots/. Exit 1 on any failure. Run: pnpm --filter @atlas/barghest smoke
// --geometry prints the measured boxes as well.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(app, 'dist');
const shots = join(app, 'dist-shots');
const showGeometry = process.argv.includes('--geometry');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('smoke: no dist/index.html; run pnpm --filter @atlas/barghest build first');
  process.exit(1);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.png': 'image/png' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
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

for (const [width, height] of [[1440, 900], [1920, 1080]]) {
  const tag = `${width}x${height}`;
  const fail = (msg) => failures.push(`${tag} ${msg}`);
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fail(`console: ${m.text()}`); });

  await page.goto(origin + '/', { waitUntil: 'load' });
  await page.locator('.app-shell').waitFor({ timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  if (new URL(page.url()).pathname !== '/a/explorer') fail(`bare / did not settle on /a/explorer: ${page.url()}`);

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
  for (const k of ['menu', 'title', 'heading']) if (!probe.family[k].startsWith(LABEL_FACE)) fail(`${k} set in "${probe.family[k]}", want ${LABEL_FACE}`);
  if (!probe.family.search.startsWith(BODY_FACE)) fail(`search input set in "${probe.family.search}", want ${BODY_FACE}`);
  if (probe.small.length) fail(`text under 14px: ${probe.small.slice(0, 5).join('; ')}`);
  if (probe.docScroll.h > 0 || probe.docScroll.w > 0) fail(`document scrolls ${JSON.stringify(probe.docScroll)}`);
  if (probe.title !== 'New exploration') fail(`menu bar title reads "${probe.title}"`);
  if (Math.round(probe.geometry.rail?.w ?? 0) !== 40) fail(`collapsed rail ${probe.geometry.rail?.w}px, want 40`);
  await page.screenshot({ path: join(shots, `shell-${tag}.png`) });

  // Tooltip on the collapsed rail, shot after its fade.
  await page.locator('.rail__views .rail__entry').first().hover();
  const tip = page.locator('.bp6-tooltip', { hasText: 'Data Sources' });
  try { await tip.waitFor({ state: 'visible', timeout: 3000 }); } catch { fail('no tooltip on the collapsed rail'); }
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(shots, `shell-${tag}-tooltip.png`) });
  await page.mouse.move(width / 2, height / 2);

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
    };
  });
  if (Math.round(expanded.w) !== 200) fail(`expanded rail ${expanded.w}px, want 200`);
  // Icons and labels open as one: no icon moves, labels hidden collapsed and shown expanded.
  if (probe.railIcons.some((x) => x !== 10) || expanded.icons.some((x) => x !== 10)) fail(`rail icons moved: collapsed ${probe.railIcons.join(',')} expanded ${expanded.icons.join(',')}, want 10 throughout`);
  if (probe.railLabelOpacity.some((o) => o !== '0') || expanded.opacity.some((o) => o !== '1')) fail(`rail label opacity collapsed ${probe.railLabelOpacity.join(',')} expanded ${expanded.opacity.join(',')}`);
  if (expanded.text !== 'Data Sources') fail(`expanded rail first label "${expanded.text}"`);
  if (LINK_BLUE.includes(expanded.color)) fail(`rail label repainted link-blue ${expanded.color}`);
  if (!expanded.family?.startsWith(LABEL_FACE)) fail(`rail label set in "${expanded.family}"`);
  await page.screenshot({ path: join(shots, `shell-${tag}-expanded.png`) });

  // The URL drives the view: a rail click moves it, back returns.
  await page.getByRole('link', { name: 'Graph' }).click();
  await page.locator('.menubar__title', { hasText: 'New graph' }).waitFor({ timeout: 3000 }).catch(() => fail('Graph click did not open Graph'));
  if (new URL(page.url()).pathname !== '/a/graph') fail(`Graph click landed on ${page.url()}`);
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
  await page.locator('.menubar__title', { hasText: 'New exploration' }).waitFor({ timeout: 3000 }).catch(() => fail('back did not return to Object Explorer'));

  if (showGeometry) console.log(tag, JSON.stringify({ ...probe.geometry, faces: probe.faces, family: probe.family, expanded }, null, 1));
  await page.close();
}

await browser.close();
server.close();

const ok = failures.length === 0;
console.log(ok ? `barghest: OK (shell at 1440x900 and 1920x1080, 0 errors) ${Date.now() - t0}ms  dist-shots/shell-*.png` : `barghest: FAIL\n${failures.join('\n')}`);
process.exit(ok ? 0 : 1);
