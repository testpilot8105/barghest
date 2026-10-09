// Ingestion: a file becomes one Document, its Passages, and one SourceRecord per table row. All deterministic and
// written through the engine (store first, then faux). Extraction (the model) runs afterwards, passage by passage.
import { createHash } from 'node:crypto';
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
 */
export async function ingestFile({ engine, meta, store, scenario, filename, buffer, system = '' }) {
  const parsed = await parseFile(filename, buffer);
  const documentId = shortId('D', scenario, filename, createHash('sha1').update(Buffer.from(buffer)).digest('hex'));
  const format = filename.split('.').pop().toLowerCase();
  const importedAt = new Date().toISOString();

  const objs = [];
  objs.push(
    toServerObject(meta, 'Document', {
      documentId,
      title: filename,
      // Where a pack file ships from; an uploaded file gets a stored copy here once step 3 lands.
      path: `data/${scenario}/sources/${filename}`,
      format,
      system,
      scenario,
      importedAt,
      status: 'imported',
    }),
  );

  const passages = splitPassages(parsed.text);
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
    params: { filename, scenario, system, format, bytes: buffer.length },
    edits: [{ type: 'addObject', objectType: 'Document', primaryKey: documentId }],
    objectIds: [`Document:${documentId}`],
  });

  return { documentId, format, passages: passages.length, records: rows.length, pages: parsed.pages ?? null, chars: parsed.text.length };
}
