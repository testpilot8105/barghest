// Stamp a demo photo with the date, place and camera the pack's story needs (engine-api.md 2.11, handoff
// section 3), so the engine reads them back on import. JPEG and PNG only; the file is rewritten in place unless
// --out names another path. Example:
//   node scripts/stamp-photo.mjs data/school-incident/photos/locker.jpg --taken 2026-09-14T09:20:00+08:00 \
//     --lat 14.5995 --lon 120.9842 --make Apple --model "iPhone 13"
import { readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { readPhoto, stampJpeg, stampPng, writeExif } from '../engine/ingest/photo.mjs';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/stamp-photo.mjs <photo.jpg|photo.png> --taken <ISO with zone> [--lat N --lon N] [--make X --model Y] [--orientation N] [--out <path>]');
  process.exit(1);
}
const args = {};
for (let i = 0; i < rest.length; i += 2) args[rest[i].replace(/^--/, '')] = rest[i + 1];

const ext = extname(file).toLowerCase().slice(1);
if (!['jpg', 'jpeg', 'png'].includes(ext)) {
  console.error(`only JPEG and PNG can be stamped: ${file}`);
  process.exit(1);
}
const bytes = readFileSync(file);
const have = readPhoto(bytes, ext);
const meta = {
  takenAt: args.taken,
  latitude: args.lat !== undefined ? Number(args.lat) : undefined,
  longitude: args.lon !== undefined ? Number(args.lon) : undefined,
  cameraMake: args.make,
  cameraModel: args.model,
  orientation: args.orientation !== undefined ? Number(args.orientation) : have.orientation,
  width: have.width,
  height: have.height,
};
const tiff = writeExif(meta);
const out = ext === 'png' ? stampPng(bytes, tiff) : stampJpeg(bytes, tiff);
writeFileSync(args.out ?? file, out);
const back = readPhoto(out, ext);
console.log(`${args.out ?? file}: ${JSON.stringify(Object.fromEntries(Object.entries(back).filter(([, v]) => v !== undefined)))}`);
