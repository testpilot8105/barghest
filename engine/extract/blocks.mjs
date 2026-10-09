// The blocks: each one kind of thing the model can be asked to list, with the ontology type it lands as. An
// investigation is a set of blocks; a template is a named set. The order here is the order schemas and prompts list
// them, and the two demo templates are exactly the sets the packs were built and tested with, so they compose to the
// same schema and prompt as before blocks existed (engine/extract/snapshots/, checked in proof:investigations).
export const BLOCKS = [
  { id: 'persons', label: 'People', type: 'Person' },
  { id: 'organizations', label: 'Organisations', type: 'Organization' },
  { id: 'locations', label: 'Places', type: 'Location' },
  { id: 'events', label: 'Events', type: 'Event' },
  { id: 'incidents', label: 'Incidents', type: 'Incident' },
  { id: 'accounts', label: 'Online accounts', type: 'DigitalAccount' },
  { id: 'groups', label: 'Online groups', type: 'OnlineGroup' },
  { id: 'firearms', label: 'Firearms', type: 'Firearm' },
  { id: 'evidence', label: 'Evidence items', type: 'EvidenceItem' },
  { id: 'schools', label: 'Schools', type: 'School' },
  { id: 'lgus', label: 'LGUs', type: 'LGU' },
  { id: 'barangays', label: 'Barangays', type: 'Barangay' },
  { id: 'haulers', label: 'Haulers', type: 'Hauler' },
  { id: 'contracts', label: 'Contracts', type: 'Contract' },
  { id: 'facilities', label: 'Facilities', type: 'Facility' },
  { id: 'vehicles', label: 'Vehicles', type: 'Vehicle' },
  { id: 'inspections', label: 'Inspections', type: 'Inspection' },
  { id: 'complaints', label: 'Complaints', type: 'Complaint' },
  { id: 'others', label: 'Other things', type: 'Thing' },
];

const BY_ID = new Map(BLOCKS.map((b) => [b.id, b]));

export const isBlock = (id) => BY_ID.has(id);
export const blockOf = (id) => BY_ID.get(id);

/** The given block ids in canonical order, each once, unknown ids dropped. */
export function normaliseBlocks(ids) {
  const want = new Set(ids ?? []);
  return BLOCKS.filter((b) => want.has(b.id)).map((b) => b.id);
}

/** The entity types the blocks produce, in block order: the relationship enum of the schema. */
export const typesOf = (ids) => normaliseBlocks(ids).map((id) => BY_ID.get(id).type);

export const TEMPLATES = [
  {
    id: 'school-incident',
    name: 'School incident',
    blocks: ['persons', 'organizations', 'locations', 'events', 'incidents', 'accounts', 'groups', 'firearms', 'evidence', 'schools'],
  },
  {
    id: 'solid-waste',
    name: 'Solid waste',
    blocks: ['persons', 'organizations', 'locations', 'events', 'lgus', 'barangays', 'haulers', 'contracts', 'facilities', 'vehicles', 'inspections', 'complaints'],
  },
  { id: 'general', name: 'General', blocks: ['persons', 'organizations', 'locations', 'events', 'others'] },
];

export const templateOf = (id) => TEMPLATES.find((t) => t.id === id);

/** The template whose blocks are exactly these, if there is one. */
export function templateMatching(ids) {
  const key = normaliseBlocks(ids).join(',');
  return TEMPLATES.find((t) => t.blocks.join(',') === key);
}

/** The block list as GET investigations serves it. */
export const blockList = () => BLOCKS.map((b) => ({ id: b.id, label: b.label, types: [b.type] }));
