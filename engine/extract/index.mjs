// Extraction: every passage of a document goes through the local model on its own, with the JSON schema built from
// its investigation's blocks; the reply is validated with zod (invalid output is logged and retried once), and what survives is
// written as candidate objects (one per mention, linked to the passage) and Relationships (with passageIds).
// Deterministic code does the rest: ids, foreign keys, the audit row. Nothing here merges anything: that is
// resolution's job.
import { createHash } from 'node:crypto';
import { toServerObject } from '../faux.mjs';
import { nameTokens, orgTokens } from '../resolve/normalize.mjs';
import { extractionPrompt, SYSTEM_EXTRACT } from './prompts.mjs';
import { jsonSchemaOf, schemaFor } from './schemas.mjs';

const PREFIX = {
  Person: 'P', Organization: 'O', Location: 'L', Event: 'E', Incident: 'I', DigitalAccount: 'A', OnlineGroup: 'G', Firearm: 'F', EvidenceItem: 'EV', School: 'S',
  LGU: 'LGU', Barangay: 'B', Hauler: 'H', Contract: 'C', Facility: 'FA', Vehicle: 'V', Inspection: 'IN', Complaint: 'CO', Thing: 'T',
};

const id = (type, passageId, name) => `${PREFIX[type] ?? type}-${createHash('sha1').update(`${passageId}|${type}|${String(name).trim().toLowerCase()}`).digest('hex').slice(0, 8)}`;
const nonEmpty = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
const iso = (s) => {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};

/** The extracted families of one passage, turned into objects of the ontology. Returns { objects, byName }. */
export function toObjects(meta, { scenario, passageId, data }) {
  const objects = [];
  const byName = new Map(); // "Type|normalised name" -> pk, for the relationships of this passage
  const titleKey = (type, name) => `${type}|${(['Organization', 'Hauler', 'School', 'LGU', 'Barangay', 'Facility', 'OnlineGroup'].includes(type) ? orgTokens(name) : nameTokens(name)).join(' ') || String(name).toLowerCase()}`;
  const add = (type, name, props) => {
    if (!nonEmpty(name)) return null;
    const pk = id(type, passageId, name);
    const def = meta.objectTypes[type].objectType;
    const obj = toServerObject(meta, type, {
      ...Object.fromEntries(Object.entries(props).filter(([, v]) => nonEmpty(v))),
      [def.primaryKey]: pk,
      [def.titleProperty]: String(name).trim(),
      passageId,
      scenario,
    });
    if (!objects.some((o) => o.__primaryKey === pk)) objects.push(obj);
    byName.set(titleKey(type, name), pk);
    return pk;
  };
  const find = (type, name) => (nonEmpty(name) ? byName.get(titleKey(type, name)) ?? null : null);
  const ensure = (type, name) => find(type, name) ?? add(type, name, {});

  for (const p of data.persons ?? []) add('Person', p.name, { role: p.role, aliases: p.aliases ?? [] });
  for (const o of data.organizations ?? []) add('Organization', o.name, { kind: o.kind });
  for (const l of data.locations ?? []) add('Location', l.name, { kind: l.kind });
  for (const s of data.schools ?? []) add('School', s.name, { depedId: s.depedId, division: s.division });
  for (const g of data.groups ?? []) add('OnlineGroup', g.name, { platform: g.platform, platformId: g.platformId, channels: g.channels ?? [] });
  for (const l of data.lgus ?? []) add('LGU', l.name, { kind: l.kind, province: l.province });
  for (const h of data.haulers ?? []) add('Hauler', h.name, { registrationNo: h.registrationNo, tin: h.tin });
  // The catch-all of the `others` block: one Thing per item, with the model's own label as its kind.
  for (const t of data.others ?? []) add('Thing', t.name, { kind: t.kind });

  for (const e of data.events ?? []) {
    const locationId = e.where ? ensure('Location', e.where) : undefined;
    add('Event', e.summary, { kind: e.kind, occurredAt: iso(e.when), locationId });
  }
  for (const i of data.incidents ?? []) {
    const locationId = i.where ? ensure('Location', i.where) : undefined;
    const schoolId = i.school ? ensure('School', i.school) : undefined;
    add('Incident', i.label, { summary: i.summary, occurredAt: iso(i.when), locationId, schoolId });
  }
  for (const b of data.barangays ?? []) add('Barangay', b.name, { lguId: b.lgu ? ensure('LGU', b.lgu) : undefined });
  for (const f of data.facilities ?? []) add('Facility', f.name, { kind: f.kind, permitNo: f.permitNo, status: f.status, lguId: f.lgu ? ensure('LGU', f.lgu) : undefined });
  for (const v of data.vehicles ?? []) add('Vehicle', v.plateNo, { bodyNo: v.bodyNo, haulerId: v.hauler ? ensure('Hauler', v.hauler) : undefined });
  for (const c of data.contracts ?? []) add('Contract', c.contractNo, { amount: c.amount, startAt: iso(c.startAt), endAt: iso(c.endAt), scope: c.scope, lguId: c.lgu ? ensure('LGU', c.lgu) : undefined, haulerId: c.hauler ? ensure('Hauler', c.hauler) : undefined });
  for (const i of data.inspections ?? []) add('Inspection', i.label, { agency: i.agency, result: i.result, inspectedAt: iso(i.when), facilityId: i.facility ? ensure('Facility', i.facility) : undefined, haulerId: i.hauler ? ensure('Hauler', i.hauler) : undefined });
  for (const c of data.complaints ?? []) add('Complaint', c.label, { channel: c.channel, category: c.category, filedAt: iso(c.when), barangayId: c.barangay ? ensure('Barangay', c.barangay) : undefined });

  for (const a of data.accounts ?? []) add('DigitalAccount', a.handle, { platform: a.platform, platformId: a.platformId, displayName: a.displayName, personId: a.ownerName ? ensure('Person', a.ownerName) : undefined });
  for (const f of data.firearms ?? []) {
    const label = [f.make, f.model, f.calibre, f.serial].filter(nonEmpty).join(' ') || f.registrationNo;
    add('Firearm', label, {
      make: f.make, model: f.model, calibre: f.calibre, serial: f.serial, feoRegistrationNo: f.registrationNo, storage: f.storage,
      registeredToId: f.registeredTo ? ensure('Person', f.registeredTo) : undefined,
      registeredAgencyId: f.registeredAgency ? ensure('Organization', f.registeredAgency) : undefined,
      custodianId: f.custodian ? ensure('Person', f.custodian) : undefined,
    });
  }
  for (const e of data.evidence ?? []) {
    const firearm = e.matchedSerial ? objects.find((o) => o.__apiName === 'Firearm' && o.serial && o.serial.toUpperCase() === String(e.matchedSerial).toUpperCase()) : null;
    add('EvidenceItem', e.tag, { kind: e.kind, custodyStatus: e.custodyStatus, matchedFirearmId: firearm?.__primaryKey, incidentId: e.recoveredAt ? find('Incident', e.recoveredAt) ?? undefined : undefined });
  }

  const relationships = [];
  for (const r of data.relationships ?? []) {
    const fromId = ensure(r.fromType, r.fromName);
    const toId = ensure(r.toType, r.toName);
    if (!fromId || !toId || fromId === toId) continue;
    const pk = `R-${createHash('sha1').update(`${passageId}|${fromId}|${r.kind}|${toId}`).digest('hex').slice(0, 8)}`;
    if (relationships.some((x) => x.__primaryKey === pk)) continue;
    const fromTitle = objects.find((o) => o.__primaryKey === fromId)?.__title ?? r.fromName;
    const toTitle = objects.find((o) => o.__primaryKey === toId)?.__title ?? r.toName;
    // A related_to link keeps the passage's own words ("paid", "met with") beside the kind, and shows them.
    const kindLabel = r.kind === 'related_to' && r.label ? String(r.label).trim() : '';
    relationships.push(
      toServerObject(meta, 'Relationship', {
        relationshipId: pk,
        label: `${fromTitle} ${kindLabel || r.kind} ${toTitle}`,
        kind: r.kind,
        kindLabel: kindLabel || undefined,
        fromType: r.fromType,
        fromId,
        toType: r.toType,
        toId,
        [`from${r.fromType}Id`]: fromId,
        [`to${r.toType}Id`]: toId,
        observedAt: iso(r.when),
        confidence: r.confidence,
        method: 'extracted',
        status: r.confidence >= 0.9 ? 'proposed' : 'review',
        passageIds: [passageId],
        recordIds: [],
        scenario,
      }),
    );
  }
  return { objects: [...objects, ...relationships], mentions: objects.length, relationships: relationships.length };
}

/**
 * Extract one document, passage by passage, looking for what its investigation's blocks name.
 * @param {string} args.investigation the investigation id, written to every object's `scenario`
 * @param {string[]} args.blocks the investigation's blocks
 */
export async function extractDocument({ engine, meta, store, llm, documentId, investigation, blocks, onPassage = null }) {
  const data = engine.data;
  const document = data.getObject('Document', documentId);
  if (!document) throw Object.assign(new Error(`document not found: ${documentId}`), { status: 404 });
  const passages = [...data.getObjectsOfType('Passage')].filter((p) => p.documentId === documentId).sort((a, b) => a.index - b.index);
  const schema = schemaFor(blocks);
  const format = jsonSchemaOf(schema);
  const scenario = investigation;

  const summary = { documentId, passages: passages.length, calls: 0, mentions: 0, relationships: 0, failed: 0, latencyMs: 0 };
  for (const passage of passages) {
    const passageId = String(passage.__primaryKey);
    let prompt = extractionPrompt({ blocks, passage, document });
    let parsed = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const r = await llm.chatJson({ system: SYSTEM_EXTRACT, prompt, schema: format, purpose: attempt ? 'extract-retry' : 'extract', documentId, passageId });
      summary.calls++;
      summary.latencyMs += r.latencyMs;
      if (!r.ok) {
        prompt += `\n\nYour previous reply was not valid JSON for the schema (${r.error}). Reply again with JSON only.`;
        continue;
      }
      const v = schema.safeParse(r.data);
      if (v.success) parsed = v.data;
      else prompt += `\n\nYour previous reply did not match the schema: ${v.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}. Reply again with JSON only.`;
    }
    if (!parsed) {
      summary.failed++;
      onPassage?.({ passageId, ok: false });
      continue;
    }
    const out = toObjects(meta, { scenario, passageId, data: parsed });
    if (out.objects.length) engine.put(out.objects);
    summary.mentions += out.mentions;
    summary.relationships += out.relationships;
    onPassage?.({ passageId, ok: true, mentions: out.mentions, relationships: out.relationships });
  }

  engine.put([{ ...document, status: summary.failed ? 'extracted with gaps' : 'extracted' }]);
  store.audit({
    action: 'extract',
    actor: 'engine+local-model',
    outcome: summary.failed ? `applied, ${summary.failed} passage(s) failed twice` : 'applied',
    params: { documentId, investigation, blocks, model: llm.models.chat },
    edits: [],
    objectIds: [`Document:${documentId}`],
  });
  return summary;
}
