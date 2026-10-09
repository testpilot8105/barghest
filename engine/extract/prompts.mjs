// The prompts. Ollama ignores the descriptions inside a JSON schema, so every field's meaning is spelled out here.
// Extraction never sees more than one passage; the passage's source system is named so the model reads a blotter
// as a blotter and a CSV row as a row.

export const SYSTEM_EXTRACT = `You are an information extraction system for an investigation workbench used by Philippine public offices.
You read ONE passage from ONE source document and list the things it states: people, organisations, places, events, accounts, firearms, evidence, and the relationships between them.
Rules:
- Only what the passage states or clearly implies. Never invent names, numbers or dates. If a field is unknown, leave it out.
- Copy names exactly as written in the passage (spelling, case, order such as "SURNAME, FIRST NAME").
- Every relationship must connect two things you listed in this same passage, by their exact names.
- Dates and times go in "when" as ISO 8601 when the passage gives them (use Asia/Manila, +08:00); otherwise leave "when" out.
- confidence is 1.0 when the passage states the relationship outright, around 0.7 when it is implied, 0.5 when it is a guess from context. Allegations and claims by officials are at most 0.8.
- Return JSON only, matching the schema. Empty arrays are fine.`;

const FIELDS_A = `Fields:
- persons[].name: the name as written. role: student, teacher, police officer, parent, guardian, suspect, victim, witness, investigator, examiner, official, handler, or other. aliases: nicknames and handles given for this person in the passage.
- organizations[].name, kind: agency, company, school, network, hauler, lgu, barangay, ideology, hospital, other.
- locations[].name, kind: school, barangay, city, province, building, residence, hospital, online, other.
- events[].summary (one line), kind (what happened), when (ISO 8601), where (a location name).
- incidents[]: a reported incident with a report or case number as label, summary, when, where, school.
- accounts[].platform (Roblox, Discord, Facebook, Facebook Messenger, TikTok, Telegram, other), handle as written, platformId (the numeric id if given), displayName, ownerName (the person's name if the passage links them).
- groups[]: online servers, groups or channels: name, platform, platformId, channels.
- firearms[]: make, model, calibre, serial, registrationNo (FEO/LTOPF/FR numbers), storage (where it was kept), registeredTo (person), registeredAgency (organisation), custodian (person holding it).
- evidence[]: tag (E-001, FCC-1, B-1 and the like), kind, custodyStatus, matchedSerial (the firearm serial a ballistics report matches it to), recoveredAt (the incident or place).
- schools[].name, depedId, division.
- relationships[]: fromName, fromType, toName, toType (types: Person, Organization, Location, Event, Incident, DigitalAccount, OnlineGroup, Firearm, EvidenceItem, School), kind, when, confidence.
  kinds: took (a person took a firearm), owns (a person owns an account or firearm), registered_to, custodian_of, recovered_at (evidence or firearm recovered at an incident or place), matched_to (evidence matched to a firearm), member_of (an account or person in a group or network), groomed_by, messaged, co_planned, posted, attends, teaches_at, guardian_of, relative_of, investigated, treated_at, located_at, part_of, mentions.`;

const FIELDS_B = `Fields:
- persons[].name as written, role: officer, engineer, inspector, mayor, contractor, complainant, driver, official, other. aliases.
- organizations[].name, kind: agency, company, hauler, lgu, barangay, other.
- locations[].name, kind: barangay, city, municipality, province, facility, landfill, dumpsite, mrf, road, other.
- events[].summary, kind, when, where.
- lgus[]: a city or municipality: name, kind (city or municipality), province.
- barangays[].name, lgu (the city or municipality it belongs to).
- haulers[]: a private hauling or waste contractor, name as written (keep "Inc.", "Svcs." as written), registrationNo (SEC/DTI/PhilGEPS), tin.
- contracts[]: contractNo, lgu, hauler, amount (a number, pesos), startAt, endAt (ISO 8601), scope (one line).
- facilities[]: name, kind (MRF, sanitary landfill, dumpsite, transfer station, other), permitNo, status, lgu.
- vehicles[]: plateNo, bodyNo, hauler.
- inspections[]: label (agency and date), agency, facility, hauler, result (one line of findings), when.
- complaints[]: label (one line), channel (8888, hotline, letter, social media), barangay, category (uncollected waste, illegal dumping, truck leakage, odor, other), when.
- relationships[]: fromName, fromType, toName, toType (types: Person, Organization, Location, Event, LGU, Barangay, Hauler, Contract, Facility, Vehicle, Inspection, Complaint), kind, when, confidence.
  kinds: contracted_by (hauler contracted by an LGU), awarded_to, serves (hauler serves a barangay or LGU), operates (hauler operates a vehicle or facility), part_of (barangay part of an LGU), inspected, filed_against, logged_at (a vehicle logged at a facility), located_at, mentions.`;

export function extractionPrompt({ scenario, passage, document }) {
  const fields = scenario === 'b' ? FIELDS_B : FIELDS_A;
  return `Source document: "${document.title}" (format ${document.format}${document.system ? `, from ${document.system}` : ''}).
Passage ${passage.index + 1} of that document follows between the markers.

${fields}

<<<PASSAGE
${passage.text}
PASSAGE>>>

List everything the passage states, as JSON.`;
}

export const SYSTEM_DECIDE = `You decide whether two records from different documents refer to the same real-world thing. Philippine names: surnames like "Dela Peña" / "Dela Pena" / "DELA PENA" are the same surname; "LASTNAME, FIRSTNAME" is the same as "Firstname Lastname"; an initial can stand for a first name; different first names are different people even with the same surname; a company's "Inc.", "Svcs.", "Services" and punctuation do not matter. Answer JSON only: same (true or false), confidence (0 to 1), reason (one sentence).`;

export function decisionPrompt(pair) {
  const show = (m) => Object.entries(m).filter(([k, v]) => !k.startsWith('__') && v != null && v !== '' && !['canonicalId', 'passageId', 'recordId', 'scenario'].includes(k)).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
  return `Type: ${pair.type}
Record A: ${show(pair.a)}
Record B: ${show(pair.b)}
A rule scored this pair ${pair.score} for these reasons: ${pair.reasons.join('; ')}.
Are A and B the same ${pair.type}?`;
}

export const SYSTEM_ASK = `You are the assistant of an investigation workbench. You answer ONLY from the records and passages given to you below. Every claim in your answer must cite a passage id from the material. If the material does not support an answer, set refused to true and say "no supporting records" in answer. Never use outside knowledge. Keep the answer under 120 words. JSON only.`;

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
