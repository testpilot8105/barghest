// Photos proof (pnpm proof:images, engine-api.md 2.11): one file of each image format imports into a folder on
// the dev seed, a stamped JPEG gives its date, place and camera and says so in its passage, the model is never
// called, an SVG is served sandboxed, a photo links to a person and becomes the picture every title read carries,
// the timeline shows it tagged analyst, and deleting the picture hands the person the next linked photo. On a
// throwaway database with the model off. The fixtures are built here: real tiny PNG, GIF, BMP and SVG pictures,
// and structurally valid JPEG, WebP, TIFF, AVIF and HEIC shells that carry the metadata the reader looks for.
// About five seconds. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { connect, engineGet } from '../src/data/client.ts';
import { fetchRows, getObjectView, searchAll } from '../src/data/reads.ts';
import { startExploration, withStep } from '../src/data/exploration.ts';
import { createFolder, deleteDocument, extractAgain, fetchInferenceLog, fileUrl, getDocumentView, getFolders, getHealth, importFile, linkImage, setPhoto, unlinkImage } from '../src/data/intake.ts';
import { isImage } from '../src/data/images.ts';
import { writeExif, stampJpeg, stampPng } from './ingest/photo.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8789;
const BASE = `http://localhost:${PORT}`;
const DB = 'data/proof-images.sqlite';
const FILES = 'data/proof-images-files';
const env = { ...process.env, BARGHEST_DB: DB, BARGHEST_ENGINE_PORT: String(PORT), BARGHEST_OLLAMA: 'off', BARGHEST_FILES: FILES };
const INV = 'school-incident';
const PERSON = 'Person:P-001';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const refused = (promise) => promise.then(() => null, (e) => e);
const eq = (property, value) => ({ filter: { property, op: 'eq', value } });

async function health() {
  try {
    const r = await fetch(`${BASE}/barghest/health`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
async function startEngine() {
  const child = spawn('node', ['engine/server.mjs'], { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 100; i++) {
    if (await health()) return child;
    await sleep(100);
  }
  child.kill();
  throw new Error('engine did not come up on ' + BASE);
}
async function stopEngine(child) {
  if (!child) return;
  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));
}
function run(script) {
  return new Promise((res, rej) => {
    const c = spawn('node', [script], { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
    c.once('exit', (code) => (code === 0 ? res() : rej(new Error(`${script} exited ${code}`))));
  });
}
const clean = () => {
  for (const suffix of ['', '-wal', '-shm']) rmSync(join(root, DB + suffix), { force: true });
  rmSync(join(root, FILES), { recursive: true, force: true });
};

// ---- Fixtures
const u16be = (v) => Buffer.from([(v >> 8) & 255, v & 255]);
const u32be = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; };
const u32le = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };

/** A JPEG shell: SOI, a baseline frame header with the size, a scan header, one byte, EOI. */
function jpegShell(width, height) {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08]), u16be(height), u16be(width), Buffer.from([0x01, 0x01, 0x11, 0x00]),
    Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x00]),
    Buffer.from([0xff, 0xd9]),
  ]);
}
/** A real PNG: width x height, opaque grey. */
function png(width, height) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    return Buffer.concat([u32be(data.length), body, u32be(crc32(body) >>> 0)]);
  };
  const ihdr = Buffer.concat([u32be(width), u32be(height), Buffer.from([8, 6, 0, 0, 0])]);
  const raw = Buffer.alloc((1 + 4 * width) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set([0x80, 0x80, 0x80, 0xff], y * (1 + 4 * width) + 1 + 4 * x);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/** A WebP shell: a lossless header carrying the size. */
function webp(width, height) {
  const bits = (width - 1) | ((height - 1) << 14);
  const vp8l = Buffer.concat([Buffer.from([0x2f]), u32le(bits), Buffer.from([0, 0, 0])]);
  return Buffer.concat([Buffer.from('RIFF', 'latin1'), u32le(4 + 8 + vp8l.length), Buffer.from('WEBPVP8L', 'latin1'), u32le(vp8l.length), vp8l]);
}
const GIF = Buffer.from('47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b', 'hex');
function bmp(width, height) {
  const rowBytes = Math.ceil((width * 3) / 4) * 4;
  const pixels = Buffer.alloc(rowBytes * height, 0x80);
  const size = 54 + pixels.length;
  const head = Buffer.concat([Buffer.from('BM', 'latin1'), u32le(size), u32le(0), u32le(54), u32le(40), u32le(width), u32le(height), Buffer.from([1, 0, 24, 0]), u32le(0), u32le(pixels.length), u32le(2835), u32le(2835), u32le(0), u32le(0)]);
  return Buffer.concat([head, pixels]);
}
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><script>document.title="pwned"</script><rect width="64" height="48" fill="#000"/></svg>', 'utf8');

/** An ISO base media shell (AVIF or HEIC): ftyp, meta with the size and an Exif item, mdat with the Exif. */
function heifShell(brand, codec, width, height, tiff) {
  const box = (type, ...parts) => { const body = Buffer.concat(parts); return Buffer.concat([u32be(8 + body.length), Buffer.from(type, 'latin1'), body]); };
  const full = (type, version, ...parts) => box(type, Buffer.from([version, 0, 0, 0]), ...parts);
  const exifPayload = Buffer.concat([u32be(0), tiff]);
  const build = (offset) => {
    const meta = full('meta', 0,
      full('hdlr', 0, u32be(0), Buffer.from('pict', 'latin1'), Buffer.alloc(12), Buffer.from([0])),
      full('pitm', 0, u16be(1)),
      full('iinf', 0, u16be(2),
        full('infe', 2, u16be(1), u16be(0), Buffer.from(codec, 'latin1'), Buffer.from([0])),
        full('infe', 2, u16be(2), u16be(0), Buffer.from('Exif', 'latin1'), Buffer.from([0]))),
      box('iprp', box('ipco', full('ispe', 0, u32be(width), u32be(height)), full('ispe', 0, u32be(64), u32be(64)))),
      full('iloc', 0, Buffer.from([0x44, 0x00]), u16be(1), u16be(2), u16be(0), u16be(1), u32be(offset), u32be(exifPayload.length)),
    );
    const ftyp = box('ftyp', Buffer.from(brand, 'latin1'), u32be(0), Buffer.from('mif1', 'latin1'), Buffer.from(brand, 'latin1'));
    return { ftyp, meta };
  };
  const first = build(0);
  const offset = first.ftyp.length + first.meta.length + 8;
  const { ftyp, meta } = build(offset);
  return Buffer.concat([ftyp, meta, box('mdat', exifPayload)]);
}

const LOCKER = { takenAt: '2026-09-14T09:20:00+08:00', latitude: 14.5995, longitude: 120.9842, cameraMake: 'Apple', cameraModel: 'iPhone 13', orientation: 1, width: 4032, height: 3024 };
const GATE = { takenAt: '2026-08-15T21:03:00+08:00', cameraMake: 'Samsung', cameraModel: 'SM-A146B' };

const fixtures = [
  { name: 'locker.jpg', type: 'image/jpeg', bytes: stampJpeg(jpegShell(4032, 3024), writeExif(LOCKER)), expect: { width: 4032, height: 3024 } },
  { name: 'gate.png', type: 'image/png', bytes: stampPng(png(2, 3), writeExif(GATE)), expect: { width: 2, height: 3, cameraMake: 'Samsung' } },
  { name: 'yard.webp', type: 'image/webp', bytes: webp(5, 4), expect: { width: 5, height: 4 } },
  { name: 'dot.gif', type: 'image/gif', bytes: GIF, expect: { width: 1, height: 1 } },
  { name: 'wall.bmp', type: 'image/bmp', bytes: bmp(3, 2), expect: { width: 3, height: 2 } },
  { name: 'badge.svg', type: 'image/svg+xml', bytes: SVG, expect: { width: 64, height: 48 } },
  { name: 'scan.tiff', type: 'image/tiff', bytes: writeExif({ width: 640, height: 480, cameraMake: 'Canon', cameraModel: 'EOS R', takenAt: '2026-09-15T10:00:00+08:00' }, { bare: true }), expect: { width: 640, height: 480, cameraMake: 'Canon' } },
  { name: 'street.avif', type: 'image/avif', bytes: heifShell('avif', 'av01', 1200, 800, writeExif({ takenAt: '2026-09-13T22:15:00+08:00', cameraMake: 'Google', cameraModel: 'Pixel 8' })), expect: { width: 1200, height: 800, cameraMake: 'Google' } },
  { name: 'room.heic', type: 'image/heic', bytes: heifShell('heic', 'hvc1', 3024, 4032, writeExif({ takenAt: '2026-09-14T07:30:00+08:00', latitude: 14.6, longitude: 121.0 })), expect: { width: 3024, height: 4032, latitude: 14.6 } },
];

async function main() {
  clean();
  await run('engine/dev-seed.mjs');
  const engine = await startEngine();
  try {
    const dc = await connect(BASE);
    const folder = await createFolder(dc, { investigation: INV, name: 'Photos' });

    // 1. Every format imports into the folder as a photo: no text read, nothing started, one passage each.
    const imported = {};
    for (const f of fixtures) imported[f.name] = await importFile(dc, { file: new File([f.bytes], f.name, { type: f.type }), investigation: INV, system: 'Phone', folderId: folder.id });
    const h = await getHealth(dc);
    const folders = await getFolders(dc, INV);
    const allPhotos = fixtures.every((f) => imported[f.name].status === 'photo' && imported[f.name].extraction === 'photo' && imported[f.name].passages === 1 && imported[f.name].records === 0);
    check('1 one file of each of nine formats imports into Photos as a photo (status and extraction "photo", one passage, no rows); health lists the formats', allPhotos && folders.folders[0]?.files === fixtures.length && ['jpg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp', 'tiff', 'heic'].every((x) => h.formats.includes(x)) && fixtures.every((f) => isImage(f.name)), `${folders.folders[0]?.files} files in Photos`);

    // 2. The stamped JPEG: date, place, camera and size on the Document, and the passage says so in its own clock.
    const jpeg = imported['locker.jpg'].documentId;
    const docRow = (await fetchRows(dc, withStep(startExploration('Document'), eq('documentId', jpeg)))).rows[0];
    const p = docRow?.properties ?? {};
    const view = await getDocumentView(dc, jpeg);
    check('2 the JPEG gives its date taken (Manila 09:20 as UTC), GPS, camera, size and orientation as source properties, and the file view carries them',
      p.takenAt === '2026-09-14T01:20:00.000Z' && p.latitude === 14.5995 && p.longitude === 120.9842 && p.cameraMake === 'Apple' && p.cameraModel === 'iPhone 13' && p.width === 4032 && p.height === 3024 && p.orientation === 1 && p.status === 'photo'
        && view.photo?.takenAt === '2026-09-14T01:20:00.000Z' && view.photo?.cameraModel === 'iPhone 13' && view.depicts.length === 0,
      `${p.takenAt} ${p.latitude},${p.longitude} ${p.cameraMake} ${p.cameraModel} ${p.width}x${p.height}`);
    check('3 its one passage reads "Photo locker.jpg taken 14 Sep 2026 09:20 at 14.5995, 120.9842 with an Apple iPhone 13, 4032 x 3024."', view.passages.length === 1 && view.passages[0].text === 'Photo locker.jpg taken 14 Sep 2026 09:20 at 14.5995, 120.9842 with an Apple iPhone 13, 4032 x 3024.', view.passages[0]?.text ?? 'none');

    // 4. The other formats: each gives what its container states.
    const misses = [];
    for (const f of fixtures.slice(1)) {
      const row = (await fetchRows(dc, withStep(startExploration('Document'), eq('documentId', imported[f.name].documentId)))).rows[0];
      for (const [k, v] of Object.entries(f.expect)) if (row?.properties[k] !== v) misses.push(`${f.name}.${k}=${row?.properties[k]}`);
    }
    const pngRow = (await fetchRows(dc, withStep(startExploration('Document'), eq('documentId', imported['gate.png'].documentId)))).rows[0];
    check('4 PNG, WebP, GIF, BMP, SVG, TIFF, AVIF and HEIC each give their size, and their Exif where the container carries one (PNG eXIf, TIFF, the HEIF Exif item)', misses.length === 0 && pngRow?.properties.takenAt === '2026-08-15T13:03:00.000Z', misses.join(' ') || 'all as stated');

    // 5. The model: never called, and refused when asked.
    const log = await fetchInferenceLog(dc);
    const extract = await refused(extractAgain(dc, jpeg));
    check('5 the model never ran (empty model log, nothing extracting) and extract on a photo is 400', log.length === 0 && h.extracting.length === 0 && extract?.status === 400, `${log.length} log rows, extract ${extract?.status}`);

    // 6. Serving: the SVG is a sandboxed document, every image has its type, nothing is sniffed.
    const svgRes = await fetch(fileUrl(dc, imported['badge.svg'].documentId));
    const jpegRes = await fetch(fileUrl(dc, jpeg));
    const svgBody = await svgRes.text();
    await jpegRes.arrayBuffer();
    check('6 the SVG is served as image/svg+xml with content-security-policy: sandbox and nosniff, bytes intact; the JPEG as image/jpeg',
      svgRes.headers.get('content-type') === 'image/svg+xml' && svgRes.headers.get('content-security-policy') === 'sandbox' && svgRes.headers.get('x-content-type-options') === 'nosniff' && svgBody === SVG.toString('utf8') && jpegRes.headers.get('content-type') === 'image/jpeg' && jpegRes.headers.get('content-security-policy') === 'sandbox',
      `${svgRes.headers.get('content-type')}; csp ${svgRes.headers.get('content-security-policy')}`);

    // 7. Link the JPEG to the seed's person: the depicts row, and the person's picture.
    const link = await linkImage(dc, jpeg, PERSON);
    const person = await getObjectView(dc, 'Person', 'P-001');
    const passagePk = view.passages[0].pk;
    check('7 linkImage writes a depicts Relationship from the Document to the person: analyst, confirmed, confidence 1, observed at the date taken, the photo\'s passage as evidence',
      link.kind === 'depicts' && link.fromType === 'Document' && link.fromId === jpeg && link.toType === 'Person' && link.toId === 'P-001' && link.method === 'analyst' && link.status === 'confirmed' && link.confidence === 1 && link.observedAt === '2026-09-14T01:20:00.000Z' && link.passageIds[0] === passagePk,
      link.relationshipId);
    check('8 the first linked photo becomes the person\'s picture: ObjectView.photo and images, photoId on the object', person.photo?.documentId === jpeg && person.photo?.url === fileUrl(dc, jpeg) && person.images.length === 1 && person.images[0].name === 'locker.jpg' && person.images[0].takenAt === '2026-09-14T01:20:00.000Z' && person.properties.find((x) => x.apiName === 'photoId')?.value === jpeg, `${person.images.length} image, photo ${person.photo?.documentId}`);

    // 9. Every title read carries it: rows, search results, what-connects objects, the file view's depicts.
    const row = (await fetchRows(dc, withStep(startExploration('Person'), eq('personId', 'P-001')))).rows[0];
    const found = await searchAll(dc, String(row.title).split(' ')[0]);
    const hit = found.Person?.top.find((t) => t.pk === 'P-001');
    const viewAfter = await getDocumentView(dc, jpeg);
    const seedLink = (await fetchRows(dc, startExploration('Relationship', 100))).rows.find((r) => (r.properties.fromType === 'Person' && r.properties.fromId === 'P-001' && r.properties.toType !== 'Document') || (r.properties.toType === 'Person' && r.properties.toId === 'P-001' && r.properties.fromType !== 'Document'));
    let connects = null;
    if (seedLink) {
      const other = seedLink.properties.fromId === 'P-001' && seedLink.properties.fromType === 'Person' ? `${seedLink.properties.toType}:${seedLink.properties.toId}` : `${seedLink.properties.fromType}:${seedLink.properties.fromId}`;
      connects = await engineGet(dc, '/barghest/what-connects', { from: PERSON, to: other });
    }
    const connectsOk = !seedLink || connects?.objects.find((o) => o.pk === 'P-001')?.photoUrl === `/barghest/file?documentId=${encodeURIComponent(jpeg)}`;
    check('9 the row and the search result carry photoUrl, what-connects objects carry photoUrl as a path (when the seed links the person), the file view says who it depicts', row.photoUrl === fileUrl(dc, jpeg) && hit?.photoUrl === fileUrl(dc, jpeg) && connectsOk && viewAfter.depicts.length === 1 && viewAfter.depicts[0].pk === 'P-001', `${seedLink ? 'what-connects checked' : 'no seed link from P-001, what-connects not covered'}`);

    // 10. The timeline: the photo at the date taken, tagged analyst, with its passage.
    const tl = await engineGet(dc, '/barghest/timeline', { objectId: PERSON, hops: '1' });
    const ev = tl.events.find((e) => e.id === `Relationship:${link.relationshipId}`);
    check('10 the person\'s timeline has the photo at the date taken, tagged analyst, with the passage for its Evidence button', Boolean(ev) && ev.tag === 'analyst' && ev.at === '2026-09-14T01:20:00.000Z' && ev.passageIds[0] === passagePk, ev ? `${ev.tag} ${ev.at}` : 'no event');

    // 11. A second photo, the picture changed and cleared, a link removed, the same link again.
    const pngId = imported['gate.png'].documentId;
    await linkImage(dc, pngId, PERSON);
    const two = await getObjectView(dc, 'Person', 'P-001');
    const set = await setPhoto(dc, PERSON, pngId);
    const afterSet = await getObjectView(dc, 'Person', 'P-001');
    const cleared = await setPhoto(dc, PERSON, null);
    const afterClear = await getObjectView(dc, 'Person', 'P-001');
    const unlinked = await unlinkImage(dc, pngId, PERSON);
    const afterUnlink = await getObjectView(dc, 'Person', 'P-001');
    const again = await linkImage(dc, jpeg, PERSON);
    check('11 a second linked photo lists newest first and leaves the picture; setPhoto changes it and null clears it; unlinkImage removes the link; the same link again is the same row',
      two.images.length === 2 && two.images[0].documentId === jpeg && two.photo?.documentId === jpeg && set.photoId === pngId && afterSet.photo?.documentId === pngId && cleared.photoId === '' && afterClear.photo === null && afterClear.images.length === 2
        && unlinked.unlinked && unlinked.photoId === '' && afterUnlink.images.length === 1 && again.relationshipId === link.relationshipId,
      `${two.images.length} then ${afterUnlink.images.length} images`);

    // 12. Refusals.
    const notPhoto = await refused(linkImage(dc, 'D-001', PERSON));
    const notEntity = await refused(linkImage(dc, jpeg, 'Document:D-001'));
    const unknownObj = await refused(linkImage(dc, jpeg, 'Person:nope'));
    const unknownLink = await refused(unlinkImage(dc, pngId, PERSON));
    const setNotPhoto = await refused(setPhoto(dc, PERSON, 'D-001'));
    check('12 linking a text file or linking to a Document is 400; an unknown object is 404; unlinking what is not linked is 404; setPhoto with a text file is 400', notPhoto?.status === 400 && notEntity?.status === 400 && unknownObj?.status === 404 && unknownLink?.status === 404 && setNotPhoto?.status === 400, `${notPhoto?.status} ${notEntity?.status} ${unknownObj?.status} ${unknownLink?.status} ${setNotPhoto?.status}`);

    // 13. Deleting the picture: the link goes, the next linked photo takes over, the audit row names it.
    await setPhoto(dc, PERSON, jpeg);
    await linkImage(dc, pngId, PERSON);
    const gone = await deleteDocument(dc, jpeg);
    const afterDelete = await getObjectView(dc, 'Person', 'P-001');
    const depictsLeft = (await fetchRows(dc, startExploration('Relationship', 100))).rows.filter((r) => r.properties.kind === 'depicts' && r.properties.fromId === jpeg);
    const auditDoc = await engineGet(dc, '/barghest/audit', { objectId: `Document:${jpeg}` });
    const del = auditDoc.find((a) => a.action === 'deleteDocument');
    check('13 deleting the picture removes its link and hands the person the other linked photo; the delete audit row names the picture it cleared',
      gone.removed.relationships === 1 && depictsLeft.length === 0 && afterDelete.photo?.documentId === pngId && afterDelete.images.length === 1 && del?.params.picturesCleared?.[0]?.objectId === PERSON && del?.params.picturesCleared?.[0]?.photoId === pngId,
      `photo now ${afterDelete.photo?.documentId}`);

    // 14. Audit rows on the person: link, set (old and new), unlink.
    const auditPerson = await engineGet(dc, '/barghest/audit', { objectId: PERSON });
    const actions = auditPerson.map((a) => a.action);
    const setRow = auditPerson.find((a) => a.action === 'setPhoto' && a.params.from === jpeg && a.params.to === pngId);
    const clearRow = auditPerson.find((a) => a.action === 'setPhoto' && a.params.from === pngId && a.params.to === '');
    check('14 audit rows by the analyst: linkImage, setPhoto with the old and the new value, the clearing, unlinkImage', actions.includes('linkImage') && actions.includes('unlinkImage') && Boolean(setRow) && Boolean(clearRow) && auditPerson.filter((a) => /Image|Photo/.test(a.action)).every((a) => a.actor === 'analyst'), actions.filter((a) => /Image|Photo/.test(a)).join(','));
  } catch (e) {
    check('no exception', false, e?.message ?? String(e));
    console.error(e);
  } finally {
    await stopEngine(engine);
    clean();
    check('teardown left no proof database and no proof files folder', !existsSync(join(root, DB)) && !existsSync(join(root, FILES)));
  }
}

await main();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `proof:images: FAIL (${failed.length} of ${results.length})` : `proof:images: OK (${results.length} checks)`);
process.exit(failed.length ? 1 : 0);
