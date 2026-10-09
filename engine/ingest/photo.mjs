// A photo's own metadata, read on import with no package and no model (engine-api.md 2.11), and written by the
// stamping script for the demo photos. One TIFF reader serves JPEG (the APP1 segment), PNG (the eXIf chunk), WebP
// (the EXIF chunk), TIFF itself and the Exif item of HEIC, HEIF and AVIF; sizes come from each container's own
// header. Everything is best effort: a field the file does not state is left out, and a broken file still imports.
import { crc32 } from 'node:zlib';

export const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp', 'tif', 'tiff', 'heic', 'heif'];
export const IMAGE_CONTENT_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  avif: 'image/avif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic', heif: 'image/heif',
};
export const isImageFormat = (format) => IMAGE_FORMATS.includes(String(format ?? '').toLowerCase());

/** A time with no zone in the metadata is read as Philippine time. */
export const DEFAULT_OFFSET = '+08:00';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---- TIFF and Exif, reading

const TAG = {
  width: 0x0100, height: 0x0101, make: 0x010f, model: 0x0110, orientation: 0x0112, exifIfd: 0x8769, gpsIfd: 0x8825,
  dateTimeOriginal: 0x9003, offsetTimeOriginal: 0x9011, pixelX: 0xa002, pixelY: 0xa003,
  gpsLatRef: 0x0001, gpsLat: 0x0002, gpsLonRef: 0x0003, gpsLon: 0x0004,
};
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readIfd(buf, offset, le) {
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const entries = new Map();
  if (offset + 2 > buf.length) return entries;
  const n = u16(offset);
  for (let i = 0; i < n; i++) {
    const e = offset + 2 + i * 12;
    if (e + 12 > buf.length) break;
    const tag = u16(e);
    const type = u16(e + 2);
    const count = u32(e + 4);
    const size = (TYPE_SIZE[type] ?? 1) * count;
    const at = size <= 4 ? e + 8 : u32(e + 8);
    if (at + size > buf.length) continue;
    let value;
    if (type === 2) value = buf.toString('latin1', at, at + count).replace(/\0+$/, '').trim();
    else if (type === 3) value = count === 1 ? u16(at) : Array.from({ length: count }, (_, k) => u16(at + 2 * k));
    else if (type === 4) value = count === 1 ? u32(at) : Array.from({ length: count }, (_, k) => u32(at + 4 * k));
    else if (type === 5) value = Array.from({ length: count }, (_, k) => { const den = u32(at + 8 * k + 4); return den ? u32(at + 8 * k) / den : 0; });
    else continue;
    entries.set(tag, value);
  }
  return entries;
}

const dms = (parts, ref) => {
  if (!Array.isArray(parts) || parts.length < 2) return undefined;
  const v = (parts[0] ?? 0) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
  const signed = /^[SW]/i.test(String(ref ?? '')) ? -v : v;
  return Number.isFinite(signed) ? Math.round(signed * 1e6) / 1e6 : undefined;
};

/** "2026:09:14 09:20:00" plus an optional "+08:00" into ISO (UTC) and the file's own clock for the passage text. */
function takenFrom(dateTime, offset) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(String(dateTime ?? ''));
  if (!m) return {};
  const zone = /^[+-]\d{2}:\d{2}$/.test(String(offset ?? '').trim()) ? String(offset).trim() : DEFAULT_OFFSET;
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${zone}`);
  if (Number.isNaN(t)) return {};
  return { takenAt: new Date(t).toISOString(), takenText: `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]} ${m[4]}:${m[5]}` };
}

/** Exif as a TIFF buffer (what sits after "Exif\0\0" in a JPEG). */
export function readTiff(buf) {
  const meta = {};
  if (!buf || buf.length < 8) return meta;
  const le = buf[0] === 0x49 && buf[1] === 0x49;
  if (!le && !(buf[0] === 0x4d && buf[1] === 0x4d)) return meta;
  try {
    const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
    const ifd0 = readIfd(buf, u32(4), le);
    if (ifd0.get(TAG.make)) meta.cameraMake = ifd0.get(TAG.make);
    if (ifd0.get(TAG.model)) meta.cameraModel = ifd0.get(TAG.model);
    if (typeof ifd0.get(TAG.orientation) === 'number') meta.orientation = ifd0.get(TAG.orientation);
    if (typeof ifd0.get(TAG.width) === 'number') meta.width = ifd0.get(TAG.width);
    if (typeof ifd0.get(TAG.height) === 'number') meta.height = ifd0.get(TAG.height);
    const exifAt = ifd0.get(TAG.exifIfd);
    if (typeof exifAt === 'number') {
      const exif = readIfd(buf, exifAt, le);
      Object.assign(meta, takenFrom(exif.get(TAG.dateTimeOriginal), exif.get(TAG.offsetTimeOriginal)));
      if (meta.width === undefined && typeof exif.get(TAG.pixelX) === 'number') meta.width = exif.get(TAG.pixelX);
      if (meta.height === undefined && typeof exif.get(TAG.pixelY) === 'number') meta.height = exif.get(TAG.pixelY);
    }
    const gpsAt = ifd0.get(TAG.gpsIfd);
    if (typeof gpsAt === 'number') {
      const gps = readIfd(buf, gpsAt, le);
      const lat = dms(gps.get(TAG.gpsLat), gps.get(TAG.gpsLatRef));
      const lon = dms(gps.get(TAG.gpsLon), gps.get(TAG.gpsLonRef));
      if (lat !== undefined && lon !== undefined) Object.assign(meta, { latitude: lat, longitude: lon });
    }
  } catch {
    // best effort: whatever was read before the break stays
  }
  return meta;
}

// ---- Containers, reading

function readJpeg(buf) {
  const meta = {};
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return meta;
  let sof = null;
  let o = 2;
  while (o + 4 <= buf.length && buf[o] === 0xff) {
    const marker = buf[o + 1];
    if (marker === 0xff) { o++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(o + 2);
    if (marker === 0xe1 && buf.toString('latin1', o + 4, o + 10) === 'Exif\0\0') Object.assign(meta, readTiff(buf.subarray(o + 10, o + 2 + len)));
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc && o + 9 <= buf.length) sof = { height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7) };
    o += 2 + len;
  }
  if (sof) Object.assign(meta, sof);
  return meta;
}

function readPng(buf) {
  const meta = {};
  if (buf.length < 24 || buf.toString('latin1', 1, 4) !== 'PNG') return meta;
  let o = 8;
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR' && len >= 8) Object.assign(meta, { width: data.readUInt32BE(0), height: data.readUInt32BE(4) });
    if (type === 'eXIf') Object.assign(meta, readTiff(data));
    if (type === 'IDAT' || type === 'IEND') break;
    o += 12 + len;
  }
  return meta;
}

const u24le = (buf, o) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);

function readWebp(buf) {
  const meta = {};
  if (buf.length < 16 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return meta;
  let o = 12;
  while (o + 8 <= buf.length) {
    const four = buf.toString('latin1', o, o + 4);
    const len = buf.readUInt32LE(o + 4);
    const d = o + 8;
    if (four === 'VP8X' && d + 10 <= buf.length) Object.assign(meta, { width: 1 + u24le(buf, d + 4), height: 1 + u24le(buf, d + 7) });
    else if (four === 'VP8 ' && d + 10 <= buf.length && meta.width === undefined) Object.assign(meta, { width: buf.readUInt16LE(d + 6) & 0x3fff, height: buf.readUInt16LE(d + 8) & 0x3fff });
    else if (four === 'VP8L' && d + 5 <= buf.length && meta.width === undefined) {
      const bits = buf.readUInt32LE(d + 1);
      Object.assign(meta, { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 });
    } else if (four === 'EXIF') {
      const data = buf.subarray(d, d + len);
      Object.assign(meta, readTiff(data.toString('latin1', 0, 6) === 'Exif\0\0' ? data.subarray(6) : data));
    }
    o = d + len + (len % 2);
  }
  return meta;
}

function readGif(buf) {
  if (buf.length < 10 || buf.toString('latin1', 0, 4) !== 'GIF8') return {};
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function readBmp(buf) {
  if (buf.length < 26 || buf.toString('latin1', 0, 2) !== 'BM') return {};
  return { width: Math.abs(buf.readInt32LE(18)), height: Math.abs(buf.readInt32LE(22)) };
}

function readSvg(buf) {
  const text = buf.toString('utf8', 0, Math.min(buf.length, 4096));
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0] ?? '';
  const num = (name) => { const m = new RegExp(`\\s${name}="([\\d.]+)(?:px)?"`, 'i').exec(tag); return m ? Math.round(Number(m[1])) : undefined; };
  let width = num('width');
  let height = num('height');
  const box = /\sviewBox="([\d.\s-]+)"/i.exec(tag);
  if ((width === undefined || height === undefined) && box) {
    const parts = box[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4) { width ??= Math.round(parts[2]); height ??= Math.round(parts[3]); }
  }
  const meta = {};
  if (width !== undefined) meta.width = width;
  if (height !== undefined) meta.height = height;
  return meta;
}

// HEIC, HEIF and AVIF: ISO base media boxes. The size comes from the largest `ispe` property, the Exif from the item
// of type "Exif" through `iinf` and `iloc` (construction method 0 only). Anything else is left out.
function* boxes(buf, start, end) {
  let o = start;
  while (o + 8 <= end) {
    let size = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    let header = 8;
    if (size === 1 && o + 16 <= end) { size = Number(buf.readBigUInt64BE(o + 8)); header = 16; }
    if (size === 0) size = end - o;
    if (size < header || o + size > end) break;
    yield { type, start: o + header, end: o + size };
    o += size;
  }
}

function readHeif(buf) {
  const meta = {};
  if (buf.length < 12 || buf.toString('latin1', 4, 8) !== 'ftyp') return meta;
  try {
    const metaBox = [...boxes(buf, 0, buf.length)].find((b) => b.type === 'meta');
    if (!metaBox) return meta;
    const inner = [...boxes(buf, metaBox.start + 4, metaBox.end)]; // meta is a full box: 4 bytes of version and flags
    let best = null;
    const iprp = inner.find((b) => b.type === 'iprp');
    const ipco = iprp && [...boxes(buf, iprp.start, iprp.end)].find((b) => b.type === 'ipco');
    for (const p of ipco ? boxes(buf, ipco.start, ipco.end) : []) {
      if (p.type !== 'ispe' || p.end - p.start < 12) continue;
      const w = buf.readUInt32BE(p.start + 4);
      const h = buf.readUInt32BE(p.start + 8);
      if (!best || w * h > best.width * best.height) best = { width: w, height: h };
    }
    if (best) Object.assign(meta, best);

    let exifItem = null;
    const iinf = inner.find((b) => b.type === 'iinf');
    if (iinf) {
      const version = buf[iinf.start];
      const countAt = iinf.start + 4;
      const entriesAt = version === 0 ? countAt + 2 : countAt + 4;
      for (const infe of boxes(buf, entriesAt, iinf.end)) {
        if (infe.type !== 'infe') continue;
        const v = buf[infe.start];
        if (v < 2) continue;
        const itemId = v === 2 ? buf.readUInt16BE(infe.start + 4) : buf.readUInt32BE(infe.start + 4);
        const typeAt = infe.start + (v === 2 ? 8 : 10);
        if (buf.toString('latin1', typeAt, typeAt + 4) === 'Exif') { exifItem = itemId; break; }
      }
    }
    const iloc = inner.find((b) => b.type === 'iloc');
    if (iloc && exifItem !== null) {
      const version = buf[iloc.start];
      let o = iloc.start + 4;
      const sizes = buf[o];
      const offsetSize = sizes >> 4;
      const lengthSize = sizes & 15;
      const baseOffsetSize = buf[o + 1] >> 4;
      const indexSize = version >= 1 ? buf[o + 1] & 15 : 0;
      o += 2;
      const count = version < 2 ? buf.readUInt16BE(o) : buf.readUInt32BE(o);
      o += version < 2 ? 2 : 4;
      const readN = (n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + buf[o + i]; o += n; return v; };
      for (let i = 0; i < count; i++) {
        const itemId = version < 2 ? readN(2) : readN(4);
        const method = version >= 1 ? readN(2) & 15 : 0;
        o += 2; // data reference index
        const base = readN(baseOffsetSize);
        const extents = readN(2);
        for (let k = 0; k < extents; k++) {
          if (indexSize) readN(indexSize);
          const off = base + readN(offsetSize);
          const len = readN(lengthSize);
          if (itemId === exifItem && method === 0 && k === 0 && off + len <= buf.length && len > 4) {
            const skip = buf.readUInt32BE(off);
            Object.assign(meta, readTiff(buf.subarray(off + 4 + skip, off + len)));
          }
        }
      }
    }
  } catch {
    // best effort
  }
  return meta;
}

/** Everything a photo says about itself; each field absent when the file does not state it. */
export function readPhoto(buffer, format) {
  const buf = Buffer.from(buffer);
  const f = String(format ?? '').toLowerCase();
  const read = f === 'jpg' || f === 'jpeg' ? readJpeg : f === 'png' ? readPng : f === 'webp' ? readWebp : f === 'gif' ? readGif : f === 'bmp' ? readBmp : f === 'svg' ? readSvg : f === 'tif' || f === 'tiff' ? readTiff : readHeif;
  let meta = {};
  try {
    meta = read(buf) ?? {};
  } catch {
    meta = {};
  }
  const out = {};
  for (const k of ['takenAt', 'latitude', 'longitude', 'cameraMake', 'cameraModel', 'width', 'height', 'orientation']) if (meta[k] !== undefined && meta[k] !== '') out[k] = meta[k];
  return { ...out, takenText: meta.takenText };
}

/** The one passage a photo gets, in the file's own clock: what was read, in plain words. */
export function photoText(filename, meta) {
  const parts = [`Photo ${filename}`];
  if (meta.takenText) parts.push(`taken ${meta.takenText}`);
  if (meta.latitude !== undefined && meta.longitude !== undefined) parts.push(`at ${meta.latitude}, ${meta.longitude}`);
  const camera = [meta.cameraMake, meta.cameraModel].filter(Boolean).join(' ');
  if (camera) parts.push(`with ${/^[aeiou]/i.test(camera) ? 'an' : 'a'} ${camera}`);
  let text = parts.join(' ');
  if (meta.width && meta.height) text += `, ${meta.width} x ${meta.height}`;
  return `${text}.`;
}

// ---- TIFF and Exif, writing (the stamping script and the proofs)

const ascii = (s) => Buffer.from(`${s}\0`, 'latin1');
const rational = (values) => {
  const b = Buffer.alloc(8 * values.length);
  values.forEach(([num, den], i) => { b.writeUInt32LE(num, i * 8); b.writeUInt32LE(den, i * 8 + 4); });
  return b;
};
const toDms = (v) => {
  const a = Math.abs(v);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60 * 1000);
  return [[d, 1], [m, 1], [s, 1000]];
};

/** entries: [{ tag, type, count, data: Buffer }] in tag order; returns the IFD bytes placed at `at`, data after it. */
function ifdBytes(entries, at) {
  entries.sort((x, y) => x.tag - y.tag);
  const head = Buffer.alloc(2 + 12 * entries.length + 4);
  head.writeUInt16LE(entries.length, 0);
  const tail = [];
  let dataAt = at + head.length;
  entries.forEach((e, i) => {
    const o = 2 + i * 12;
    head.writeUInt16LE(e.tag, o);
    head.writeUInt16LE(e.type, o + 2);
    head.writeUInt32LE(e.count, o + 4);
    if (e.data.length <= 4) e.data.copy(head, o + 8);
    else {
      head.writeUInt32LE(dataAt, o + 8);
      const padded = e.data.length % 2 ? Buffer.concat([e.data, Buffer.alloc(1)]) : e.data;
      tail.push(padded);
      dataAt += padded.length;
    }
  });
  return Buffer.concat([head, ...tail]);
}
const ifdSize = (entries) => 2 + 12 * entries.length + 4 + entries.reduce((n, e) => n + (e.data.length <= 4 ? 0 : e.data.length + (e.data.length % 2)), 0);
const short = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
const long = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };

/**
 * A little-endian TIFF holding the given fields: IFD0 (make, model, orientation, and the size when `bare` for a
 * TIFF file of its own), an Exif IFD (date taken with its zone, pixel size) and a GPS IFD.
 */
export function writeExif({ takenAt, latitude, longitude, cameraMake, cameraModel, orientation, width, height } = {}, { bare = false } = {}) {
  const ifd0 = [];
  const exif = [];
  const gps = [];
  if (cameraMake) ifd0.push({ tag: TAG.make, type: 2, count: cameraMake.length + 1, data: ascii(cameraMake) });
  if (cameraModel) ifd0.push({ tag: TAG.model, type: 2, count: cameraModel.length + 1, data: ascii(cameraModel) });
  if (orientation) ifd0.push({ tag: TAG.orientation, type: 3, count: 1, data: short(orientation) });
  if (bare && width && height) {
    ifd0.push({ tag: TAG.width, type: 4, count: 1, data: long(width) });
    ifd0.push({ tag: TAG.height, type: 4, count: 1, data: long(height) });
  }
  if (takenAt) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?([+-]\d{2}:\d{2}|Z)?/.exec(String(takenAt));
    if (!m) throw new Error(`takenAt must be an ISO date with a zone, like 2026-09-14T09:20:00+08:00: ${takenAt}`);
    const stamp = `${m[1]}:${m[2]}:${m[3]} ${m[4]}:${m[5]}:${m[6] ?? '00'}`;
    const zone = m[7] === 'Z' ? '+00:00' : m[7] ?? DEFAULT_OFFSET;
    exif.push({ tag: TAG.dateTimeOriginal, type: 2, count: stamp.length + 1, data: ascii(stamp) });
    exif.push({ tag: TAG.offsetTimeOriginal, type: 2, count: zone.length + 1, data: ascii(zone) });
  }
  if (width && height && !bare) {
    exif.push({ tag: TAG.pixelX, type: 4, count: 1, data: long(width) });
    exif.push({ tag: TAG.pixelY, type: 4, count: 1, data: long(height) });
  }
  if (latitude !== undefined && longitude !== undefined) {
    gps.push({ tag: TAG.gpsLatRef, type: 2, count: 2, data: ascii(latitude < 0 ? 'S' : 'N') });
    gps.push({ tag: TAG.gpsLat, type: 5, count: 3, data: rational(toDms(latitude)) });
    gps.push({ tag: TAG.gpsLonRef, type: 2, count: 2, data: ascii(longitude < 0 ? 'W' : 'E') });
    gps.push({ tag: TAG.gpsLon, type: 5, count: 3, data: rational(toDms(longitude)) });
  }
  const pointers = (exif.length ? 1 : 0) + (gps.length ? 1 : 0);
  const at0 = 8;
  const size0 = ifdSize(ifd0) + 12 * pointers;
  const atExif = at0 + size0;
  const atGps = atExif + (exif.length ? ifdSize(exif) : 0);
  if (exif.length) ifd0.push({ tag: TAG.exifIfd, type: 4, count: 1, data: long(atExif) });
  if (gps.length) ifd0.push({ tag: TAG.gpsIfd, type: 4, count: 1, data: long(atGps) });
  const header = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
  return Buffer.concat([header, ifdBytes(ifd0, at0), exif.length ? ifdBytes(exif, atExif) : Buffer.alloc(0), gps.length ? ifdBytes(gps, atGps) : Buffer.alloc(0)]);
}

/** A JPEG with this Exif in its APP1 segment, any earlier Exif segment dropped. */
export function stampJpeg(jpeg, tiff) {
  const buf = Buffer.from(jpeg);
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG');
  const kept = [];
  let o = 2;
  while (o + 4 <= buf.length && buf[o] === 0xff) {
    const marker = buf[o + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(o + 2);
    const segment = buf.subarray(o, o + 2 + len);
    if (!(marker === 0xe1 && segment.toString('latin1', 4, 10) === 'Exif\0\0')) kept.push(segment);
    o += 2 + len;
  }
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const app1 = Buffer.alloc(4);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([buf.subarray(0, 2), app1, payload, ...kept, buf.subarray(o)]);
}

/** A PNG with this Exif in an eXIf chunk right after IHDR, any earlier eXIf chunk dropped. */
export function stampPng(png, tiff) {
  const buf = Buffer.from(png);
  if (buf.toString('latin1', 1, 4) !== 'PNG') throw new Error('not a PNG');
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const out = [buf.subarray(0, 8)];
  let o = 8;
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    const whole = buf.subarray(o, o + 12 + len);
    if (type !== 'eXIf') out.push(whole);
    if (type === 'IHDR') out.push(chunk('eXIf', tiff));
    o += 12 + len;
  }
  return Buffer.concat(out);
}
