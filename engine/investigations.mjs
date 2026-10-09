// Investigations: records in the store, outside the ontology, the way Compass folders are not ontology objects.
// Each one is a fixed id, a name the analyst may change later, and the blocks the model looks for. The two demo
// investigations are created at engine start when missing: real records, not dev seed, so they stay at P10.
import { createHash, randomBytes } from 'node:crypto';
import { blockList, isBlock, normaliseBlocks, TEMPLATES, templateOf } from './extract/blocks.mjs';

const bad = (message) => Object.assign(new Error(message), { status: 400 });

export const DEMO_INVESTIGATIONS = [
  { id: 'school-incident', name: 'School incident', template: 'school-incident' },
  { id: 'solid-waste', name: 'Solid waste', template: 'solid-waste' },
];

/** Create the two demo investigations if the store lacks them. Returns how many were created. */
export function ensureDemoInvestigations(store) {
  let created = 0;
  for (const demo of DEMO_INVESTIGATIONS) {
    if (store.investigation(demo.id)) continue;
    const record = { ...demo, blocks: [...templateOf(demo.template).blocks], createdAt: new Date().toISOString() };
    store.putInvestigation(record);
    store.audit({ action: 'createInvestigation', actor: 'engine', params: { id: demo.id, name: demo.name, template: demo.template, blocks: record.blocks }, edits: [], objectIds: [`Investigation:${demo.id}`] });
    created++;
  }
  return created;
}

/** A URL-safe id from a name: ascii letters, digits and dashes, plus a short hash so two names never collide. */
export function slugOf(name) {
  const base =
    String(name)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'investigation';
  const hash = createHash('sha1').update(`${name}|${Date.now()}|${randomBytes(4).toString('hex')}`).digest('hex').slice(0, 6);
  return `${base}-${hash}`;
}

/**
 * POST investigations. `blocks` win over `template`; neither means the `general` template. Refuses an empty name, an
 * unknown template or an unknown block with 400. Writes an audit row.
 */
export function createInvestigation(store, { name, template, blocks } = {}) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw bad('name is required');
  if (template != null && !templateOf(template)) throw bad(`unknown template: ${template}; one of ${TEMPLATES.map((t) => t.id).join(', ')}`);
  if (blocks != null && !Array.isArray(blocks)) throw bad('blocks must be a list of block ids');
  const given = Array.isArray(blocks) && blocks.length > 0;
  if (given) {
    const unknown = blocks.filter((b) => !isBlock(b));
    if (unknown.length) throw bad(`unknown block(s): ${unknown.join(', ')}`);
  }
  const chosen = given ? normaliseBlocks(blocks) : [...templateOf(template ?? 'general').blocks];
  let id = slugOf(trimmed);
  while (store.investigation(id)) id = slugOf(trimmed);
  const record = { id, name: trimmed, template: template ?? (given ? null : 'general'), blocks: chosen, createdAt: new Date().toISOString() };
  store.putInvestigation(record);
  store.audit({ action: 'createInvestigation', actor: 'analyst', params: { id, name: trimmed, template: record.template, blocks: chosen }, edits: [], objectIds: [`Investigation:${id}`] });
  return { ...record, documents: 0 };
}

/** GET investigations: every record with its document count, the templates, and the block list. */
export function listInvestigations(store, data) {
  const docs = new Map();
  for (const d of data.getObjectsOfType('Document')) docs.set(d.scenario, (docs.get(d.scenario) ?? 0) + 1);
  return {
    investigations: store.investigations().map((inv) => ({ ...inv, documents: docs.get(inv.id) ?? 0 })),
    templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, blocks: [...t.blocks] })),
    blocks: blockList(),
  };
}
