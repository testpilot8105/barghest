// Ingestion: a file becomes one Document, its Passages, and one SourceRecord per table row. All deterministic and
// written through the engine (store first, then faux). Extraction (the model) runs afterwards, passage by passage.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { toServerObject } from '../faux.mjs';
import { systemFlags } from './flags.mjs';
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
  // A scanned PDF or an empty file yields nothing to read: say so instead of failing quietly later. A photo says
  // it is one: the model never reads it, its metadata and one passage of plain text are what there is (2.11).
  const status = parsed.photo ? 'photo' : parsed.text.trim().length === 0 ? 'no text' : 'imported';

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
      // The shown name and register start as the title and the system; a rename writes these, never those.
      name: filename,
      register: system || undefined,
      // A photo's own metadata (takenAt, latitude, longitude, cameraMake, cameraModel, width, height, orientation).
      ...(parsed.photo ?? {}),
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

  // What the engine notices in the file on its own (engine-api.md 2.9): Relationships with method "system".
  const flagged = status === 'no text' ? { objects: [], flags: [] } : systemFlags({ meta, scenario, documentId, parsed, passages });
  objs.push(...flagged.objects);

  engine.put(objs);
  store.audit({
    action: 'importDocument',
    actor: 'analyst',
    outcome: 'applied',
    params: { filename, scenario, system, format, bytes: buffer.length, path, status, folderId: folderId || '', flags: flagged.flags.length },
    edits: [{ type: 'addObject', objectType: 'Document', primaryKey: documentId }],
    objectIds: [`Document:${documentId}`],
  });
  for (const f of flagged.flags) {
    store.audit({
      action: 'flag',
      actor: 'engine',
      outcome: 'applied',
      params: { documentId, filename, scenario, label: f.label, observedAt: f.observedAt, passageId: f.passageId, recordId: f.recordId },
      edits: [{ type: 'addObject', objectType: 'Relationship', primaryKey: f.relationshipId }],
      objectIds: [...f.objectIds, `Document:${documentId}`],
    });
  }

  return { documentId, format, passages: passages.length, records: rows.length, pages: parsed.pages ?? null, chars: parsed.text.length, status, path, flags: flagged.flags.length };
}
