// Dev seed (pnpm seed:dev): the school-incident cast, written straight into the store so the shell and the proofs have
// data before extraction works. Never runs at boot; restart the engine after seeding. Deleted at P10. Every name,
// account, number and report here is fictional.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { toServerObject } from './faux.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB = resolve(root, process.env.BARGHEST_DB ?? 'data/barghest.sqlite');
const meta = JSON.parse(readFileSync(join(root, 'ontology', 'ontology.json'), 'utf8'));

const INVESTIGATION = 'school-incident';
const rows = [];
const add = (type, props) => rows.push(toServerObject(meta, type, { scenario: INVESTIGATION, ...props }));

// School and place
add('School', { schoolId: 'S-001', name: 'San Isidro National High School', depedId: '303912', division: 'San Mateo' });
add('Location', { locationId: 'L-001', name: 'San Isidro National High School, Barangay Mabini, City of San Mateo', kind: 'school' });

// People
add('Person', { personId: 'P-001', fullName: 'Joaquin Dela Peña', aliases: ['Wacky'], role: 'subject', schoolId: 'S-001' });
add('Person', { personId: 'P-002', fullName: 'Marco Villarin', aliases: [], role: 'co-planner', schoolId: 'S-001' });
add('Person', { personId: 'P-003', fullName: 'Althea Ramos', aliases: [], role: 'victim', schoolId: 'S-001' });
add('Person', { personId: 'P-004', fullName: 'Jerome Catacutan', aliases: [], role: 'victim', schoolId: 'S-001' });
add('Person', { personId: 'P-005', fullName: 'Princess Mae Bautista', aliases: [], role: 'victim', schoolId: 'S-001' });
add('Person', { personId: 'P-006', fullName: 'Lorna Abalos', aliases: ['Ms. L. Abalos'], role: 'teacher', schoolId: 'S-001' });
add('Person', { personId: 'P-007', fullName: 'Rowena Dela Peña', aliases: ['PSSg R. Dela Peña'], role: 'police officer' });
add('Person', { personId: 'P-008', fullName: 'Ramon Villarin', aliases: [], role: 'parent' });
add('Person', { personId: 'P-009', fullName: 'Vesper Krael', aliases: ['Vesper_Krael', '@vkrael', 'VesperK'], role: 'unknown' });
add('Person', { personId: 'P-010', fullName: 'Nestor Dela Peña', aliases: [], role: 'parent' });

// Digital accounts (platform counts: Roblox 3, Discord 3, Facebook Messenger 2, TikTok 1, Telegram 1, Facebook 1)
add('DigitalAccount', { accountId: 'A-001', platform: 'Roblox', handle: 'wckyy_09', platformId: '4417820931', personId: 'P-001' });
add('DigitalAccount', { accountId: 'A-002', platform: 'Facebook Messenger', handle: 'Joaquin DP', platformId: '100071122334455', personId: 'P-001' });
add('DigitalAccount', { accountId: 'A-003', platform: 'Discord', handle: 'hollow.ix', platformId: '912338817221345280', personId: 'P-001' });
add('DigitalAccount', { accountId: 'A-004', platform: 'TikTok', handle: '@hollow.ix', platformId: '7219944830021', personId: 'P-001' });
add('DigitalAccount', { accountId: 'A-005', platform: 'Roblox', handle: 'mrc_v14', platformId: '4418123377', personId: 'P-002' });
add('DigitalAccount', { accountId: 'A-006', platform: 'Discord', handle: 'nullveil', platformId: '915402211783901', personId: 'P-002' });
add('DigitalAccount', { accountId: 'A-007', platform: 'Facebook Messenger', handle: 'Marco V.', platformId: '100072299001122', personId: 'P-002' });
add('DigitalAccount', { accountId: 'A-008', platform: 'Discord', handle: 'Vesper_Krael', platformId: '884217700112233', personId: 'P-009' });
add('DigitalAccount', { accountId: 'A-009', platform: 'Telegram', handle: '@vkrael', platformId: '6613221109', personId: 'P-009' });
add('DigitalAccount', { accountId: 'A-010', platform: 'Roblox', handle: 'VesperK', platformId: '3901177205', personId: 'P-009' });
add('DigitalAccount', { accountId: 'A-011', platform: 'Facebook', handle: 'Rowena DP', platformId: '100045566778899', personId: 'P-007' });

// Groups and networks
add('OnlineGroup', { groupId: 'G-001', name: 'SIDEWINDER RP', platform: 'Roblox', platformId: '33871204', channels: [] });
add('OnlineGroup', { groupId: 'G-002', name: 'VOIDHOUSE', platform: 'Discord', platformId: '1183322990011223344', channels: ['#gates', '#void-logs', '#proof'] });
add('OnlineGroup', { groupId: 'G-003', name: 'vkrael_drops', platform: 'Telegram', platformId: '-1001882211009', channels: [] });
add('Organization', { organizationId: 'O-001', name: '764', kind: 'network' });
add('Organization', { organizationId: 'O-002', name: 'No Lives Matter (NLM)', kind: 'ideology' });
add('Organization', { organizationId: 'O-003', name: 'Philippine National Police', kind: 'agency' });

// Firearms and the incident
add('Firearm', {
  firearmId: 'F-001', label: 'Glock 17 Gen 4 BHPZ417', make: 'Glock', model: '17 Gen 4', calibre: '9x19mm', serial: 'BHPZ417',
  feoRegistrationNo: 'GOV-PNP-2024-18827', storage: 'locked plastic locker', registeredAgencyId: 'O-003', custodianId: 'P-007',
});
add('Firearm', {
  firearmId: 'F-002', label: 'Armscor M200 RIA38-1177093', make: 'Armscor', model: 'M200', calibre: '.38 Special', serial: 'RIA38-1177093',
  feoRegistrationNo: 'FR-2023-0917-55021', storage: 'vehicle glovebox', registeredToId: 'P-008',
});
add('Incident', {
  incidentId: 'I-001', label: 'I-001 San Isidro NHS, 14 Sep 2026', summary: 'Shooting at the junior high building, entry through the north emergency exit.',
  occurredAt: '2026-09-14T00:42:00Z', locationId: 'L-001', schoolId: 'S-001',
});
add('EvidenceItem', { evidenceId: 'E-001', tag: 'E-001', kind: 'firearm, Glock 17 recovered at scene', custodyStatus: 'SOCO', matchedFirearmId: 'F-001', incidentId: 'I-001' });
add('EvidenceItem', { evidenceId: 'E-002', tag: 'E-002', kind: 'firearm, Armscor M200 recovered at scene', custodyStatus: 'SOCO', matchedFirearmId: 'F-002', incidentId: 'I-001' });

// One document, two passages, the second one the message the "took" relationship rests on
add('Document', {
  documentId: 'D-001', title: 'Messenger thread, extract from DFER-R14-2026-0188', path: 'data/school-incident/sources/messenger-thread.txt',
  format: 'txt', system: 'PNP-ACG Cyber Forensics', importedAt: '2026-10-09T00:00:00Z', status: 'imported',
});
add('Passage', {
  passageId: 'PS-001', label: 'messenger-thread.txt #1 (M-0107)', documentId: 'D-001', index: 0,
  text: 'M-0107 27 Jul 2026 21:12 VesperK: dito na tayo mag-usap. add me hollow.ix sa discord', charStart: 0, charEnd: 88,
});
add('Passage', {
  passageId: 'PS-002', label: 'messenger-thread.txt #2 (M-0188)', documentId: 'D-001', index: 1,
  text: 'M-0188 11 Sep 2026 23:41 Joaquin DP to Marco V.: nakuha ko na. sa locker lang pala. bukas na', charStart: 89, charEnd: 182,
});

// Relationships: the edges with evidence
add('Relationship', {
  relationshipId: 'R-001', label: 'Joaquin Dela Peña took Glock 17 BHPZ417', kind: 'took',
  fromType: 'Person', fromId: 'P-001', toType: 'Firearm', toId: 'F-001', fromPersonId: 'P-001', toFirearmId: 'F-001',
  observedAt: '2026-09-13T14:15:00Z', confidence: 0.9, method: 'extracted', status: 'confirmed', passageIds: ['PS-002'], recordIds: [],
});
add('Relationship', {
  relationshipId: 'R-002', label: 'hollow.ix member_of VOIDHOUSE', kind: 'member_of',
  fromType: 'DigitalAccount', fromId: 'A-003', toType: 'OnlineGroup', toId: 'G-002', fromDigitalAccountId: 'A-003', toOnlineGroupId: 'G-002',
  observedAt: '2026-08-03T00:00:00Z', confidence: 0.95, method: 'extracted', status: 'confirmed', passageIds: [], recordIds: [],
});
add('Relationship', {
  relationshipId: 'R-003', label: 'hollow.ix groomed_by Vesper_Krael', kind: 'groomed_by',
  fromType: 'DigitalAccount', fromId: 'A-003', toType: 'DigitalAccount', toId: 'A-008', fromDigitalAccountId: 'A-003', toDigitalAccountId: 'A-008',
  observedAt: '2026-09-05T00:00:00Z', confidence: 0.86, method: 'extracted', status: 'review', passageIds: [], recordIds: [],
});

// One resolution: the Roblox handle to the subject, on the nickname alone
add('Resolution', {
  resolutionId: 'RS-001', label: 'wckyy_09 is Joaquin Dela Peña', candidateIds: ['DigitalAccount:A-001'], canonicalType: 'Person', canonicalId: 'P-001',
  decision: 'same', confidence: 0.62, decidedBy: 'local-model', method: 'nickname match', decidedAt: '2026-10-09T00:00:00Z',
  reason: "'Wacky' is the subject's nickname in intake sheet GO-2026-031; join date and avatar name match the Messenger profile",
});

const store = openStore(DB);
store.upsertMany(rows);
const counts = store.countByType();
store.close();
console.log(`seed:dev: ${rows.length} objects into ${DB}`);
console.log(Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', '));
