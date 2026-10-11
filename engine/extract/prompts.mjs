// The prompts. Ollama ignores the descriptions inside a JSON schema, so every field's meaning is spelled out here.
// Extraction never sees more than one passage; the passage's source system is named so the model reads a blotter
// as a blotter and a CSV row as a row. The field list follows the investigation's blocks: the two demo templates
// keep their hand-written lists word for word (snapshotted), any other set of blocks gets one line per block.
import { normaliseBlocks, templateMatching, typesOf } from './blocks.mjs';
import { RELATED_TO, RELATIONSHIP_KINDS } from './schemas.mjs';

export const SYSTEM_EXTRACT = `You are an information extraction system for an investigation workbench used by public offices in Maharlika.
You read ONE passage from ONE source document and list the things it states: people, organisations, places, events, accounts, firearms, evidence, and the relationships between them.
Rules:
- Only what the passage states or clearly implies. Never invent names, numbers or dates. If a field is unknown, leave it out.
- Copy names exactly as written in the passage (spelling, case, order such as "SURNAME, FIRST NAME").
- Every relationship must connect two things you listed in this same passage, by their exact names.
- Dates and times go in "when" as ISO 8601 when the passage gives them (use Asia/Manila, +08:00); otherwise leave "when" out.
- confidence is 1.0 when the passage states the relationship outright, around 0.7 when it is implied, 0.5 when it is a guess from context. Allegations and claims by officials are at most 0.8.
- Return JSON only, matching the schema. Empty arrays are fine.`;

const FIELDS_SCHOOL_INCIDENT = `Fields:
- persons[].name: the name as written. role: student, teacher, police officer, parent, guardian, suspect, victim, witness, investigator, examiner, official, handler, or other. aliases: nicknames and handles given for this person in the passage.
- organizations[].name, kind: agency, company, school, network, hauler, lgu, barangay, ideology, hospital, other.
- locations[].name, kind: school, barangay, city, province, building, residence, hospital, online, other.
- events[].summary (one line), kind (what happened), when (ISO 8601), where (a location name).
- incidents[]: a reported incident with a report or case number as label, summary, when, where, school.
- accounts[].platform (Roblox, Discord, Facebook, Facebook Messenger, TikTok, Telegram, other), handle as written, platformId (the numeric id if given), displayName, ownerName (the person's name if the passage links them). In a chat export or message log, the sender and receiver names on each line ("Joaquin DP to Marco V.:") are accounts on that platform with handle as written, not persons; list a person only when the passage gives a real name.
- groups[]: online servers, groups or channels: name, platform, platformId, channels.
- firearms[]: make, model, calibre, serial, registrationNo (FLD, licence or FR numbers), storage (where it was kept), registeredTo (person), registeredAgency (organisation), custodian (person holding it).
- evidence[]: tag (E-001, FCC-1, B-1 and the like), kind, custodyStatus, matchedSerial (the firearm serial a ballistics report matches it to), recoveredAt (the incident or place).
- schools[].name, depedId, division.
- relationships[]: fromName, fromType, toName, toType (types: Person, Organization, Location, Event, Incident, DigitalAccount, OnlineGroup, Firearm, EvidenceItem, School), kind, when, confidence.
  kinds: took (a person took a firearm), owns (a person owns an account or firearm), registered_to, custodian_of, recovered_at (evidence or firearm recovered at an incident or place), matched_to (evidence matched to a firearm), member_of (an account or person in a group or network), groomed_by, messaged, co_planned, posted, attends, teaches_at, guardian_of, relative_of, investigated, treated_at, located_at, part_of, mentions.`;

const FIELDS_SOLID_WASTE = `Fields:
- persons[].name as written, role: officer, engineer, inspector, mayor, contractor, complainant, driver, official, other. aliases.
- organizations[].name, kind: agency, company, hauler, lgu, barangay, other.
- locations[].name, kind: barangay, city, municipality, province, facility, landfill, dumpsite, mrf, road, other.
- events[].summary, kind, when, where.
- lgus[]: a city or municipality: name, kind (city or municipality), province.
- barangays[].name, lgu (the city or municipality it belongs to).
- haulers[]: a private hauling or waste contractor, name as written (keep "Inc.", "Svcs." as written), registrationNo (state or procurement registry), tin.
- contracts[]: contractNo, lgu, hauler, amount (a number, pesos), startAt, endAt (ISO 8601), scope (one line).
- facilities[]: name, kind (MRF, sanitary landfill, dumpsite, transfer station, other), permitNo, status, lgu.
- vehicles[]: plateNo, bodyNo, hauler.
- inspections[]: label (agency and date), agency, facility, hauler, result (one line of findings), when.
- complaints[]: label (one line), channel (311, hotline, letter, social media), barangay, category (uncollected waste, illegal dumping, truck leakage, odor, other), when.
- relationships[]: fromName, fromType, toName, toType (types: Person, Organization, Location, Event, LGU, Barangay, Hauler, Contract, Facility, Vehicle, Inspection, Complaint), kind, when, confidence.
  kinds: contracted_by (hauler contracted by an LGU), awarded_to, serves (hauler serves a barangay or LGU), operates (hauler operates a vehicle or facility), part_of (barangay part of an LGU), inspected, filed_against, logged_at (a vehicle logged at a facility), located_at, mentions.`;

// The two demo templates' lists, word for word as the packs were tested with.
const TEMPLATE_FIELDS = { 'school-incident': FIELDS_SCHOOL_INCIDENT, 'solid-waste': FIELDS_SOLID_WASTE };

// One line per block for any other set of blocks.
const BLOCK_LINES = {
  persons: '- persons[].name: the name as written. role: what the passage calls them (student, teacher, officer, official, inspector, contractor, driver, suspect, victim, witness, complainant, or other). aliases: nicknames and handles given for this person in the passage.',
  organizations: '- organizations[].name, kind: agency, company, school, network, hauler, lgu, barangay, ideology, hospital, other.',
  locations: '- locations[].name, kind: school, barangay, city, municipality, province, building, residence, facility, landfill, road, hospital, online, other.',
  events: '- events[].summary (one line), kind (what happened), when (ISO 8601), where (a location name).',
  incidents: '- incidents[]: a reported incident with a report or case number as label, summary, when, where, school.',
  accounts: '- accounts[].platform (Roblox, Discord, Facebook, Facebook Messenger, TikTok, Telegram, other), handle as written, platformId (the numeric id if given), displayName, ownerName (the person\'s name if the passage links them). In a chat export or message log, the sender and receiver names on each line are accounts on that platform with handle as written, not persons; list a person only when the passage gives a real name.',
  groups: '- groups[]: online servers, groups or channels: name, platform, platformId, channels.',
  firearms: '- firearms[]: make, model, calibre, serial, registrationNo (FLD, licence or FR numbers), storage (where it was kept), registeredTo (person), registeredAgency (organisation), custodian (person holding it).',
  evidence: '- evidence[]: tag (E-001, FCC-1, B-1 and the like), kind, custodyStatus, matchedSerial (the firearm serial a ballistics report matches it to), recoveredAt (the incident or place).',
  schools: '- schools[].name, depedId, division.',
  lgus: '- lgus[]: a city or municipality: name, kind (city or municipality), province.',
  barangays: '- barangays[].name, lgu (the city or municipality it belongs to).',
  haulers: '- haulers[]: a private hauling or waste contractor, name as written (keep "Inc.", "Svcs." as written), registrationNo (state or procurement registry), tin.',
  contracts: '- contracts[]: contractNo, lgu, hauler, amount (a number, pesos), startAt, endAt (ISO 8601), scope (one line).',
  facilities: '- facilities[]: name, kind (MRF, sanitary landfill, dumpsite, transfer station, other), permitNo, status, lgu.',
  vehicles: '- vehicles[]: plateNo, bodyNo, hauler.',
  inspections: '- inspections[]: label (agency and date), agency, facility, hauler, result (one line of findings), when.',
  complaints: '- complaints[]: label (one line), channel (311, hotline, letter, social media), barangay, category (uncollected waste, illegal dumping, truck leakage, odor, other), when.',
  others: '- others[]: anything an investigator would care about that fits none of the lists above (a vessel, a bank account, a document, a programme, a weapon that is not a firearm): name as written, kind (your own one or two word label for what it is, such as "ship" or "bank account").',
};

const KIND_GLOSS =
  'took (a person took a firearm), owns (a person owns an account, a vehicle or a firearm), registered_to, custodian_of, recovered_at (evidence or a firearm recovered at an incident or place), matched_to (evidence matched to a firearm), member_of (an account or person in a group or network), groomed_by, messaged, co_planned, posted, attends, teaches_at, guardian_of, relative_of, investigated, treated_at, located_at, part_of (a barangay part of an LGU, a unit part of an agency), contracted_by (a hauler contracted by an LGU), awarded_to, serves (a hauler serves a barangay or LGU), operates (a hauler operates a vehicle or facility), inspected, filed_against, logged_at (a vehicle logged at a facility), mentions';

function composedFields(ids) {
  const others = ids.includes('others');
  const lines = ids.map((id) => BLOCK_LINES[id]);
  lines.push(
    `- relationships[]: fromName, fromType, toName, toType (types: ${typesOf(ids).join(', ')}), kind, when, confidence${others ? ', label (only with related_to)' : ''}.
  kinds: ${KIND_GLOSS}${others ? `, ${RELATED_TO} (any other link between two things you listed: put the passage's own words for it, such as "paid" or "met with", in label)` : ''}.`,
  );
  return `Fields:\n${lines.join('\n')}`;
}

/** The field list for a set of blocks: a template's own words when the blocks are exactly a template's, else composed. */
export function fieldsFor(blocks) {
  const ids = normaliseBlocks(blocks);
  const template = templateMatching(ids);
  return (template && TEMPLATE_FIELDS[template.id]) || composedFields(ids);
}

// Every kind the gloss names exists in the schema, and nothing else; a drift here would mislead the model.
if (RELATIONSHIP_KINDS.some((k) => !KIND_GLOSS.includes(k))) throw new Error('prompts.mjs: KIND_GLOSS misses a relationship kind');

export function extractionPrompt({ blocks, passage, document }) {
  const fields = fieldsFor(blocks);
  return `Source document: "${document.title}" (format ${document.format}${document.system ? `, from ${document.system}` : ''}).
Passage ${passage.index + 1} of that document follows between the markers.

${fields}

<<<PASSAGE
${passage.text}
PASSAGE>>>

List everything the passage states, as JSON.`;
}

export const SYSTEM_DECIDE = `You decide whether two records from different documents refer to the same real-world thing. Names: surnames like "Dela Peña" / "Dela Pena" / "DELA PENA" are the same surname; "LASTNAME, FIRSTNAME" is the same as "Firstname Lastname"; an initial can stand for a first name; different first names are different people even with the same surname; a company's "Inc.", "Svcs.", "Services" and punctuation do not matter. Answer JSON only: same (true or false), confidence (0 to 1), reason (one sentence).`;

export function decisionPrompt(pair) {
  const show = (m) => Object.entries(m).filter(([k, v]) => !k.startsWith('__') && v != null && v !== '' && !['canonicalId', 'passageId', 'recordId', 'scenario'].includes(k)).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
  return `Type: ${pair.type}
Record A: ${show(pair.a)}
Record B: ${show(pair.b)}
A rule scored this pair ${pair.score} for these reasons: ${pair.reasons.join('; ')}.
${pair.question ?? `Are A and B the same ${pair.type}?`}`;
}

export const SYSTEM_ASK = `You are the assistant of an investigation workbench. You answer ONLY from the records and passages given to you below. Every claim in your answer must cite a passage id from the material. The files often use other words than the question: a question about a "perpetrator" is answered by what the files say about "suspects". Answer in the files' own words. When the material answers only part of the question, say what it does say and what it does not (for example "The files name no main perpetrator; the field report lists two suspects, ..."), cite it, and set refused to false. Set refused to true and say "no supporting records" in answer only when nothing in the material bears on the question. Never use outside knowledge. Keep the answer under 120 words. JSON only.`;

export function askPrompt({ question, objects, passages }) {
  const objs = objects.map((o) => `- ${o.type} ${o.pk}: ${o.title}${o.detail ? ` (${o.detail})` : ''}`).join('\n');
  const pass = passages.map((p) => `[${p.pk}] (${p.label}) ${p.text}`).join('\n\n');
  return `Question: ${question}

Records found:
${objs || '(none)'}

Passages found:
${pass || '(none)'}

Answer from the material above, citing passage ids.`;
}
