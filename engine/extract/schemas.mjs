// What the model may say about a passage: one zod schema per object family, composed into one schema per scenario
// so a passage costs one call. The same zod schema validates the reply before anything touches the store, and
// z.toJSONSchema() produces the `format` Ollama constrains its decoding with.
import { z } from 'zod';

const str = z.string();
const opt = z.string().optional();
const conf = z.number().min(0).max(1);

export const RELATIONSHIP_KINDS = [
  'took', 'owns', 'registered_to', 'custodian_of', 'recovered_at', 'matched_to', 'member_of', 'groomed_by', 'messaged', 'co_planned', 'posted',
  'attends', 'teaches_at', 'guardian_of', 'relative_of', 'investigated', 'treated_at', 'located_at', 'part_of', 'contracted_by', 'serves', 'operates',
  'inspected', 'filed_against', 'awarded_to', 'logged_at', 'mentions',
];

export const ENTITY_TYPES_A = ['Person', 'Organization', 'Location', 'Event', 'Incident', 'DigitalAccount', 'OnlineGroup', 'Firearm', 'EvidenceItem', 'School'];
export const ENTITY_TYPES_B = ['Person', 'Organization', 'Location', 'Event', 'LGU', 'Barangay', 'Hauler', 'Contract', 'Facility', 'Vehicle', 'Inspection', 'Complaint'];

export const families = {
  persons: z.array(z.object({ name: str, role: opt, aliases: z.array(str).optional() })),
  organizations: z.array(z.object({ name: str, kind: z.enum(['agency', 'company', 'school', 'network', 'hauler', 'lgu', 'barangay', 'ideology', 'hospital', 'other']).optional() })),
  locations: z.array(z.object({ name: str, kind: opt })),
  events: z.array(z.object({ summary: str, kind: opt, when: opt, where: opt })),
  incidents: z.array(z.object({ label: str, summary: opt, when: opt, where: opt, school: opt })),
  accounts: z.array(z.object({ platform: str, handle: str, platformId: opt, displayName: opt, ownerName: opt })),
  groups: z.array(z.object({ name: str, platform: opt, platformId: opt, channels: z.array(str).optional() })),
  firearms: z.array(z.object({ make: opt, model: opt, calibre: opt, serial: opt, registrationNo: opt, storage: opt, registeredTo: opt, registeredAgency: opt, custodian: opt })),
  evidence: z.array(z.object({ tag: str, kind: opt, custodyStatus: opt, matchedSerial: opt, recoveredAt: opt })),
  schools: z.array(z.object({ name: str, depedId: opt, division: opt })),
  lgus: z.array(z.object({ name: str, kind: opt, province: opt })),
  barangays: z.array(z.object({ name: str, lgu: opt })),
  haulers: z.array(z.object({ name: str, registrationNo: opt, tin: opt })),
  contracts: z.array(z.object({ contractNo: str, lgu: opt, hauler: opt, amount: z.number().optional(), startAt: opt, endAt: opt, scope: opt })),
  facilities: z.array(z.object({ name: str, kind: opt, permitNo: opt, status: opt, lgu: opt })),
  vehicles: z.array(z.object({ plateNo: str, bodyNo: opt, hauler: opt })),
  inspections: z.array(z.object({ label: str, agency: opt, facility: opt, hauler: opt, result: opt, when: opt })),
  complaints: z.array(z.object({ label: str, channel: opt, barangay: opt, category: opt, when: opt })),
};

const relationships = (types) =>
  z.array(
    z.object({
      fromName: str,
      fromType: z.enum(types),
      toName: str,
      toType: z.enum(types),
      kind: z.enum(RELATIONSHIP_KINDS),
      when: opt,
      confidence: conf,
    }),
  );

export const scenarioA = z.object({
  persons: families.persons,
  organizations: families.organizations,
  locations: families.locations,
  events: families.events,
  incidents: families.incidents,
  accounts: families.accounts,
  groups: families.groups,
  firearms: families.firearms,
  evidence: families.evidence,
  schools: families.schools,
  relationships: relationships(ENTITY_TYPES_A),
});

export const scenarioB = z.object({
  persons: families.persons,
  organizations: families.organizations,
  locations: families.locations,
  events: families.events,
  lgus: families.lgus,
  barangays: families.barangays,
  haulers: families.haulers,
  contracts: families.contracts,
  facilities: families.facilities,
  vehicles: families.vehicles,
  inspections: families.inspections,
  complaints: families.complaints,
  relationships: relationships(ENTITY_TYPES_B),
});

// The P2 probe: a Person and an Event from one paragraph.
export const probeSchema = z.object({ persons: families.persons, events: families.events });

export const decisionSchema = z.object({ same: z.boolean(), confidence: conf, reason: str });

export const answerSchema = z.object({
  answer: str,
  citations: z.array(z.object({ passageId: str, quote: str })),
  refused: z.boolean(),
});

/** Ollama wants plain JSON schema in `format`; descriptions are ignored, so the prompts repeat them. */
export function jsonSchemaOf(schema) {
  return z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' });
}

export const schemaFor = (scenario) => (scenario === 'b' ? scenarioB : scenarioA);
