// Deterministic parsing: a file in, its text and (for tables) its rows out. No model here. PDF through pdfjs-dist
// (Apache 2.0), CSV through papaparse (MIT), TXT and JSON through Node itself.
import { extname } from 'node:path';
import Papa from 'papaparse';

export const FORMATS = ['pdf', 'csv', 'txt', 'json', 'md'];

export function formatOf(filename) {
  const ext = extname(filename).toLowerCase().slice(1);
  if (ext === 'md') return 'txt';
  return FORMATS.includes(ext) ? ext : null;
}

async function parsePdf(buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Items carry their own line breaks as hasEOL; join words with spaces and lines with newlines.
    let line = '';
    const lines = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trimEnd());
        line = '';
      } else if (item.str && !item.str.endsWith(' ')) line += ' ';
    }
    if (line.trim()) lines.push(line.trimEnd());
    pages.push(lines.join('\n'));
  }
  await doc.cleanup?.();
  return { text: pages.join('\n\n'), rows: null, pages: pages.length };
}

function parseCsv(text) {
  const parsed = Papa.parse(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy', dynamicTyping: false });
  const rows = parsed.data.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), typeof v === 'string' ? v.trim() : v])));
  const columns = parsed.meta.fields ?? [];
  // The text form of a table: one line per row, "column: value" pairs, so passages and the model see real sentences.
  const lines = rows.map((row) => columns.map((c) => (row[c] !== '' && row[c] != null ? `${c}: ${row[c]}` : null)).filter(Boolean).join('; '));
  return { text: lines.join('\n'), rows, columns };
}

function parseJson(text) {
  const value = JSON.parse(text);
  // An array of objects is a table; an object with array fields is several tables; anything else is one record.
  let rows = [];
  if (Array.isArray(value)) rows = value.filter((v) => v && typeof v === 'object');
  else if (value && typeof value === 'object') {
    for (const [key, list] of Object.entries(value)) {
      if (Array.isArray(list)) for (const item of list) if (item && typeof item === 'object') rows.push({ _collection: key, ...item });
    }
    if (rows.length === 0) rows = [value];
  }
  const lines = rows.map((row) => Object.entries(row).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('; '));
  return { text: lines.join('\n'), rows, columns: [...new Set(rows.flatMap((r) => Object.keys(r)))] };
}

/** @returns {Promise<{ text: string, rows: object[] | null, columns?: string[], pages?: number }>} */
export async function parseFile(filename, buffer) {
  const format = formatOf(filename);
  if (!format) throw new Error(`unsupported file type: ${filename} (pdf, csv, txt, md, json)`);
  if (format === 'pdf') return parsePdf(buffer);
  const text = Buffer.from(buffer).toString('utf8');
  if (format === 'csv') return parseCsv(text);
  if (format === 'json') return parseJson(text);
  return { text: text.replace(/\r\n/g, '\n'), rows: null };
}
