// Ingestion: a file becomes one Document, its Passages, and one SourceRecord per table row. All deterministic and
// written through the engine (store first, then faux). Extraction (the model) runs afterwards, passage by passage.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { toServerObject } from '../faux.mjs';
import { parseFile } from './parse.mjs';
import { splitPassages } from './passages.mjs';

const DATE_KEYS = /^(date|datetime|timestamp|observed_?at|filed_?at|created_?at|time|when|reported_?at|inspected_?at|awarded_?at|award_?date)$/i;

function shortId(prefix, ...parts) {
  return `${prefix}-${createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 10)}`;
}

function observedAtOf(row) {
  for (const [k, v] of Object.entries(row)) {
    if (!DATE_KEYS.test(k) || typeof v !== 'string') continue;
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return undefined;
}

function recordLabel(filename, row, i) {
  const firstText = Object.values(row).find((v) => typeof v === 'string' && v.trim() && v.length < 80);
  return `${filename} row ${i + 1}${firstText ? `: ${firstText}` : ''}`;
}

/**
 * @param {object} args
 * @param {{ put(objs: object[]): void }} args.engine
 * @param {object} args.meta ontology.json
 * @param {{ audit(entry: object): void }} args.store
 * @param {string} args.scenario the investigation id (the property keeps its internal name)
 * @param {string} args.filename
 * @param {Uint8Array | Buffer} args.buffer
 * @param {string} [args.system] which register the file pretends to come from
 * @param {string} [args.folderId] the folder the file lands in; empty is the investigation's top level
 * @param {string} [args.filesDir] where the stored original goes (absolute); without it no copy is kept
 * @param {string} [args.root] the app folder, so the Document's `path` is relative to it
 */
export async function ingestFile({ engine, meta, store, scenario, filename, buffer, system = '', folderId = '', filesDir = null, root = null }) {
  const parsed = await parseFile(filename, buffer);
  const documentId = shortId('D', scenario, filename, createHash('sha1').update(Buffer.from(buffer)).digest('hex'));
  const format = filename.split('.').pop().toLowerCase();
  const importedAt = new Date().toISOString();
  // A scanned PDF or an empty file yields nothing to read: say so instead of failing quietly later.
  const status = parsed.text.trim().length === 0 ? 'no text' : 'imported';

  // Keep the original: the file view opens it, and a later move re-imports it from this copy.
  let path = `data/${scenario}/sources/${filename}`;
  if (filesDir) {
    mkdirSync(filesDir, { recursive: true });
    const stored = join(filesDir, `${documentId}.${format}`);
    writeFileSync(stored, Buffer.from(buffer));
    path = (root ? relative(root, stored) : stored).split(sep).join('/');
  }

  const objs = [];
  objs.push(
    toServerObject(meta, 'Document', {
      documentId,
      title: filename,
      path,
      format,
      system,
      scenario,
      importedAt,
      status,
      folderId: folderId || undefined,
    }),
  );

  const passages = status === 'no text' ? [] : splitPassages(parsed.text);
  for (const p of passages) {
    objs.push(
      toServerObject(meta, 'Passage', {
        passageId: `${documentId}-p${p.index}`,
        label: `${filename} #${p.index + 1}`,
        documentId,
        index: p.index,
        text: p.text,
        charStart: p.charStart,
        charEnd: p.charEnd,
      }),
    );
  }

  const rows = parsed.rows ?? [];
  rows.forEach((row, i) => {
    objs.push(
      toServerObject(meta, 'SourceRecord', {
        recordId: `${documentId}-r${i}`,
        label: recordLabel(filename, row, i),
        documentId,
        system,
        rawJson: JSON.stringify(row),
        observedAt: observedAtOf(row),
      }),
    );
  });

  engine.put(objs);
  store.audit({
    action: 'importDocument',
    actor: 'analyst',
    outcome: 'applied',
    params: { filename, scenario, system, format, bytes: buffer.length, path, status, folderId: folderId || '' },
    edits: [{ type: 'addObject', objectType: 'Document', primaryKey: documentId }],
    objectIds: [`Document:${documentId}`],
  });

  return { documentId, format, passages: passages.length, records: rows.length, pages: parsed.pages ?? null, chars: parsed.text.length, status, path };
}
