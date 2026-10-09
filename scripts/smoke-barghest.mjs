// BARGHEST smoke: serve dist/ and prove the first screen, not describe it. The level-1 heading is painted inside
// the viewport at a real size, the line's font (Source Sans 3 Variable) is loaded and used, and no console error
// fired. Screenshot to dist-shots/home.png. Exit 1 on any failure. Run: pnpm --filter @atlas/barghest smoke
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(app, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('smoke: no dist/index.html; run pnpm --filter @atlas/barghest build first');
  process.exit(1);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = join(dist, decodeURIComponent(url.pathname));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: 'chromium', headless: true });
const t0 = Date.now();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto(origin, { waitUntil: 'load' });
try { await page.getByRole('heading', { name: "BARGHEST", level: 1 }).waitFor({ timeout: 10000 }); } catch (e) { errors.push(`heading: ${e.message}`); }

const FACE = 'Source Sans 3 Variable';
const probe = await page.evaluate(async (face) => {
  await document.fonts.ready;
  const h1 = document.querySelector('h1');
  const r = h1 ? h1.getBoundingClientRect() : null;
  const bare = (s) => s.replace(/^["']|["']$/g, '');
  return {
    fontPx: h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0,
    inView: !!r && r.width > 0 && r.bottom > 0 && r.top < innerHeight,
    loaded: [...document.fonts].some((f) => bare(f.family) === face && f.status === 'loaded'),
    h1Font: h1 ? getComputedStyle(h1).fontFamily : '',
  };
}, FACE);
if (!probe.inView || probe.fontPx < 14) errors.push(`heading: not painted at a real size ${JSON.stringify(probe)}`);
if (!probe.loaded || !probe.h1Font.replace(/["']/g, '').startsWith(FACE)) errors.push(`font: ${FACE} not loaded or not used ${JSON.stringify(probe)}`);

mkdirSync(join(app, 'dist-shots'), { recursive: true });
await page.screenshot({ path: join(app, 'dist-shots', 'home.png'), fullPage: true });
await browser.close();
server.close();

const ok = errors.length === 0;
console.log(ok ? `barghest: OK (heading, ${FACE}, 0 errors) ${Date.now() - t0}ms  dist-shots/home.png` : `barghest: FAIL\n${errors.join('\n')}`);
process.exit(ok ? 0 : 1);
