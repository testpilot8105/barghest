// The BARGHEST ontology as code, compiled by @osdk/maker (pnpm ontology:build). The core that extraction targets,
// the school-incident pack, the solid-waste pack and the Thing catch-all. Every type has one primary key,
// a title property, a display name and a plural; every property has a display name, because the Object Explorer
// builds its pickers from these. Relationships are objects (faux links carry no properties); provenance is a link
// you can walk, not an id list. Names freeze when P1 is committed; a rename goes in docs/engine-api.md.
import {
  defineCreateObjectAction,
  defineLink,
  defineModifyObjectAction,
  defineObject,
} from '@osdk/maker';
import type { ObjectPropertyTypeUserDefinition, ObjectTypeDefinition } from '@osdk/maker';

type Props = Record<string, ObjectPropertyTypeUserDefinition>;

const str = (displayName: string): ObjectPropertyTypeUserDefinition => ({ type: 'string', displayName });
const strs = (displayName: string): ObjectPropertyTypeUserDefinition => ({ type: 'string', displayName, array: true });
const num = (displayName: string): ObjectPropertyTypeUserDefinition => ({ type: 'double', displayName });
const int = (displayName: string): ObjectPropertyTypeUserDefinition => ({ type: 'integer', displayName });
const when = (displayName: string): ObjectPropertyTypeUserDefinition => ({ type: 'timestamp', displayName });

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Shared by every entity type (not by Document, Passage, SourceRecord, Relationship, Resolution): where the object
// came from and what it resolved to. A canonical object has an empty canonicalId. `scenario` keeps its internal
// name and holds the investigation id; its display name is "Investigation".
const provenance: Props = {
  canonicalId: str('Canonical object'),
  passageId: str('Passage'),
  recordId: str('Source record'),
  scenario: str('Investigation'),
};

function entity(def: Omit<ObjectTypeDefinition, 'properties'> & { properties: Props }): ObjectTypeDefinition {
  return defineObject({ ...def, properties: { ...def.properties, ...provenance } });
}

// ---- Core

const Document = defineObject({
  apiName: 'Document',
  displayName: 'Document',
  pluralDisplayName: 'Documents',
  primaryKeyPropertyApiName: 'documentId',
  titlePropertyApiName: 'title',
  properties: {
    documentId: str('Document id'),
    title: str('Title'),
    path: str('Path'),
    format: str('Format'),
    system: str('Source system'),
    scenario: str('Investigation'),
    importedAt: when('Imported at'),
    status: str('Status'),
  },
});

const Passage = defineObject({
  apiName: 'Passage',
  displayName: 'Passage',
  pluralDisplayName: 'Passages',
  primaryKeyPropertyApiName: 'passageId',
  titlePropertyApiName: 'label',
  properties: {
    passageId: str('Passage id'),
    label: str('Label'),
    documentId: str('Document'),
    index: int('Index'),
    text: { type: 'string', displayName: 'Text' },
    charStart: int('Start offset'),
    charEnd: int('End offset'),
  },
});

const SourceRecord = defineObject({
  apiName: 'SourceRecord',
  displayName: 'Source record',
  pluralDisplayName: 'Source records',
  primaryKeyPropertyApiName: 'recordId',
  titlePropertyApiName: 'label',
  properties: {
    recordId: str('Record id'),
    label: str('Label'),
    documentId: str('Document'),
    system: str('Source system'),
    rawJson: str('Raw row (JSON)'),
    observedAt: when('Observed at'),
  },
});

const Person = entity({
  apiName: 'Person',
  displayName: 'Person',
  pluralDisplayName: 'People',
  primaryKeyPropertyApiName: 'personId',
  titlePropertyApiName: 'fullName',
  properties: {
    personId: str('Person id'),
    fullName: str('Full name'),
    aliases: strs('Aliases'),
    role: str('Role'),
    schoolId: str('School'),
  },
});

const Organization = entity({
  apiName: 'Organization',
  displayName: 'Organization',
  pluralDisplayName: 'Organizations',
  primaryKeyPropertyApiName: 'organizationId',
  titlePropertyApiName: 'name',
  properties: {
    organizationId: str('Organization id'),
    name: str('Name'),
    kind: str('Kind'),
  },
});

const Location = entity({
  apiName: 'Location',
  displayName: 'Location',
  pluralDisplayName: 'Locations',
  primaryKeyPropertyApiName: 'locationId',
  titlePropertyApiName: 'name',
  properties: {
    locationId: str('Location id'),
    name: str('Name'),
    kind: str('Kind'),
    lat: num('Latitude'),
    lon: num('Longitude'),
  },
});

const Event = entity({
  apiName: 'Event',
  displayName: 'Event',
  pluralDisplayName: 'Events',
  primaryKeyPropertyApiName: 'eventId',
  titlePropertyApiName: 'summary',
  properties: {
    eventId: str('Event id'),
    summary: str('Summary'),
    kind: str('Kind'),
    occurredAt: when('Occurred at'),
    startAt: when('Start'),
    endAt: when('End'),
    locationId: str('Location'),
  },
});

// ---- The school-incident pack

const DigitalAccount = entity({
  apiName: 'DigitalAccount',
  displayName: 'Digital account',
  pluralDisplayName: 'Digital accounts',
  primaryKeyPropertyApiName: 'accountId',
  titlePropertyApiName: 'handle',
  properties: {
    accountId: str('Account id'),
    handle: str('Handle'),
    platform: str('Platform'),
    platformId: str('Platform user id'),
    displayName: str('Display name'),
    personId: str('Owner'),
  },
});

const OnlineGroup = entity({
  apiName: 'OnlineGroup',
  displayName: 'Online group',
  pluralDisplayName: 'Online groups',
  primaryKeyPropertyApiName: 'groupId',
  titlePropertyApiName: 'name',
  properties: {
    groupId: str('Group id'),
    name: str('Name'),
    platform: str('Platform'),
    platformId: str('Platform group id'),
    channels: strs('Channels'),
  },
});

const Incident = entity({
  apiName: 'Incident',
  displayName: 'Incident',
  pluralDisplayName: 'Incidents',
  primaryKeyPropertyApiName: 'incidentId',
  titlePropertyApiName: 'label',
  properties: {
    incidentId: str('Incident id'),
    label: str('Label'),
    summary: str('Summary'),
    occurredAt: when('Occurred at'),
    locationId: str('Location'),
    schoolId: str('School'),
  },
});

const Firearm = entity({
  apiName: 'Firearm',
  displayName: 'Firearm',
  pluralDisplayName: 'Firearms',
  primaryKeyPropertyApiName: 'firearmId',
  titlePropertyApiName: 'label',
  properties: {
    firearmId: str('Firearm id'),
    label: str('Label'),
    make: str('Make'),
    model: str('Model'),
    calibre: str('Calibre'),
    serial: str('Serial number'),
    feoRegistrationNo: str('FEO registration no.'),
    storage: str('Storage'),
    registeredToId: str('Registered to (person)'),
    registeredAgencyId: str('Registered agency'),
    custodianId: str('Custodian'),
  },
});

const EvidenceItem = entity({
  apiName: 'EvidenceItem',
  displayName: 'Evidence item',
  pluralDisplayName: 'Evidence items',
  primaryKeyPropertyApiName: 'evidenceId',
  titlePropertyApiName: 'tag',
  properties: {
    evidenceId: str('Evidence id'),
    tag: str('Tag'),
    kind: str('Kind'),
    custodyStatus: str('Custody status'),
    matchedFirearmId: str('Matched firearm'),
    incidentId: str('Recovered at'),
  },
});

const School = entity({
  apiName: 'School',
  displayName: 'School',
  pluralDisplayName: 'Schools',
  primaryKeyPropertyApiName: 'schoolId',
  titlePropertyApiName: 'name',
  properties: {
    schoolId: str('School id'),
    name: str('Name'),
    depedId: str('DepEd school id'),
    division: str('Division'),
  },
});

// ---- The solid-waste pack: solid waste across three LGUs

const LGU = entity({
  apiName: 'LGU',
  displayName: 'LGU',
  pluralDisplayName: 'LGUs',
  primaryKeyPropertyApiName: 'lguId',
  titlePropertyApiName: 'name',
  properties: {
    lguId: str('LGU id'),
    name: str('Name'),
    kind: str('Kind'),
    province: str('Province'),
  },
});

const Barangay = entity({
  apiName: 'Barangay',
  displayName: 'Barangay',
  pluralDisplayName: 'Barangays',
  primaryKeyPropertyApiName: 'barangayId',
  titlePropertyApiName: 'name',
  properties: {
    barangayId: str('Barangay id'),
    name: str('Name'),
    lguId: str('LGU'),
  },
});

const Hauler = entity({
  apiName: 'Hauler',
  displayName: 'Hauler',
  pluralDisplayName: 'Haulers',
  primaryKeyPropertyApiName: 'haulerId',
  titlePropertyApiName: 'name',
  properties: {
    haulerId: str('Hauler id'),
    name: str('Name'),
    registrationNo: str('Registration no.'),
    tin: str('TIN'),
  },
});

const Contract = entity({
  apiName: 'Contract',
  displayName: 'Contract',
  pluralDisplayName: 'Contracts',
  primaryKeyPropertyApiName: 'contractId',
  titlePropertyApiName: 'contractNo',
  properties: {
    contractId: str('Contract id'),
    contractNo: str('Contract no.'),
    lguId: str('LGU'),
    haulerId: str('Hauler'),
    amount: num('Amount'),
    startAt: when('Start'),
    endAt: when('End'),
    scope: str('Scope'),
  },
});

const Facility = entity({
  apiName: 'Facility',
  displayName: 'Facility',
  pluralDisplayName: 'Facilities',
  primaryKeyPropertyApiName: 'facilityId',
  titlePropertyApiName: 'name',
  properties: {
    facilityId: str('Facility id'),
    name: str('Name'),
    kind: str('Kind'),
    permitNo: str('Permit no.'),
    status: str('Status'),
    lguId: str('LGU'),
  },
});

const Vehicle = entity({
  apiName: 'Vehicle',
  displayName: 'Vehicle',
  pluralDisplayName: 'Vehicles',
  primaryKeyPropertyApiName: 'vehicleId',
  titlePropertyApiName: 'plateNo',
  properties: {
    vehicleId: str('Vehicle id'),
    plateNo: str('Plate no.'),
    bodyNo: str('Body no.'),
    haulerId: str('Hauler'),
  },
});

const Inspection = entity({
  apiName: 'Inspection',
  displayName: 'Inspection',
  pluralDisplayName: 'Inspections',
  primaryKeyPropertyApiName: 'inspectionId',
  titlePropertyApiName: 'label',
  properties: {
    inspectionId: str('Inspection id'),
    label: str('Label'),
    agency: str('Agency'),
    facilityId: str('Facility'),
    haulerId: str('Hauler'),
    result: str('Result'),
    inspectedAt: when('Inspected at'),
  },
});

const Complaint = entity({
  apiName: 'Complaint',
  displayName: 'Complaint',
  pluralDisplayName: 'Complaints',
  primaryKeyPropertyApiName: 'complaintId',
  titlePropertyApiName: 'label',
  properties: {
    complaintId: str('Complaint id'),
    label: str('Label'),
    channel: str('Channel'),
    barangayId: str('Barangay'),
    category: str('Category'),
    filedAt: when('Filed at'),
  },
});

// ---- The catch-all. Only the `others` block produces these: one object per thing the model names that fits no
// other type, with the model's own label for what it is ("ship", "bank account"). The two demo packs never do.

const Thing = entity({
  apiName: 'Thing',
  displayName: 'Other thing',
  pluralDisplayName: 'Other things',
  primaryKeyPropertyApiName: 'thingId',
  titlePropertyApiName: 'name',
  properties: {
    thingId: str('Thing id'),
    name: str('Name'),
    kind: str('Kind'),
  },
});

// ---- The entity types: what a Relationship can connect, what resolution can merge. Order is display order.

const ENTITIES: Array<[ObjectTypeDefinition, string]> = [
  [Person, 'people'],
  [Organization, 'organizations'],
  [Location, 'locations'],
  [Event, 'events'],
  [DigitalAccount, 'digitalAccounts'],
  [OnlineGroup, 'onlineGroups'],
  [Incident, 'incidents'],
  [Firearm, 'firearms'],
  [EvidenceItem, 'evidenceItems'],
  [School, 'schools'],
  [LGU, 'lgus'],
  [Barangay, 'barangays'],
  [Hauler, 'haulers'],
  [Contract, 'contracts'],
  [Facility, 'facilities'],
  [Vehicle, 'vehicles'],
  [Inspection, 'inspections'],
  [Complaint, 'complaints'],
  [Thing, 'things'],
];

// ---- Relationship: an edge with evidence. One optional foreign key per entity type at each end, so a plain pivot
// walks Person -> relationshipsFrom -> toFirearm, and Search Around gets one count per link.

const relationshipEnds: Props = {};
for (const [type] of ENTITIES) {
  relationshipEnds[`from${type.apiName}Id`] = str(`From ${type.displayName.toLowerCase()}`);
  relationshipEnds[`to${type.apiName}Id`] = str(`To ${type.displayName.toLowerCase()}`);
}

const relationshipProps: Props = {
  relationshipId: str('Relationship id'),
  label: str('Label'),
  kind: str('Kind'),
  // The passage's own words for a related_to link ("paid", "met with"); empty for every other kind.
  kindLabel: str('Kind, as written'),
  fromType: str('From type'),
  fromId: str('From id'),
  toType: str('To type'),
  toId: str('To id'),
  observedAt: when('Observed at'),
  confidence: num('Confidence'),
  method: str('Method'),
  status: str('Status'),
  reviewNote: str('Review note'),
  passageIds: strs('Passages'),
  recordIds: strs('Source records'),
  scenario: str('Investigation'),
  ...relationshipEnds,
};

const Relationship = defineObject({
  apiName: 'Relationship',
  displayName: 'Relationship',
  pluralDisplayName: 'Relationships',
  primaryKeyPropertyApiName: 'relationshipId',
  titlePropertyApiName: 'label',
  properties: relationshipProps,
});

const Resolution = defineObject({
  apiName: 'Resolution',
  displayName: 'Resolution',
  pluralDisplayName: 'Resolutions',
  primaryKeyPropertyApiName: 'resolutionId',
  titlePropertyApiName: 'label',
  properties: {
    resolutionId: str('Resolution id'),
    label: str('Label'),
    candidateIds: strs('Candidates'),
    canonicalType: str('Canonical type'),
    canonicalId: str('Canonical object'),
    decision: str('Decision'),
    confidence: num('Confidence'),
    decidedBy: str('Decided by'),
    method: str('Method'),
    decidedAt: when('Decided at'),
    reason: str('Reason'),
    scenario: str('Investigation'),
  },
});

// ---- Links. The object holding the foreign key is the "many" side. In maker, each side's metadata names the link
// that lives ON that object: `one.metadata` is the one object's link to its many (Person.digitalAccounts),
// `toMany.metadata` is the many object's link back to its one (DigitalAccount.owner). Checked in ontology.json.

function oneToMany(
  one: ObjectTypeDefinition,
  oneLink: [apiName: string, displayName: string],
  many: ObjectTypeDefinition,
  manyLink: [apiName: string, displayName: string, pluralDisplayName: string],
  foreignKey: string,
) {
  defineLink({
    apiName: `${kebab(many.apiName)}-${kebab(oneLink[0])}`,
    one: { object: one, metadata: { apiName: manyLink[0], displayName: manyLink[1], pluralDisplayName: manyLink[2] } },
    toMany: { object: many, metadata: { apiName: oneLink[0], displayName: oneLink[1] } },
    manyForeignKeyProperty: foreignKey,
  });
}

// One-hop links for the common facts.
oneToMany(Document, ['document', 'Document'], Passage, ['passages', 'Passage', 'Passages'], 'documentId');
oneToMany(Document, ['document', 'Document'], SourceRecord, ['records', 'Source record', 'Source records'], 'documentId');
oneToMany(Person, ['owner', 'Owner'], DigitalAccount, ['digitalAccounts', 'Digital account', 'Digital accounts'], 'personId');
oneToMany(School, ['school', 'School'], Person, ['people', 'Person', 'People'], 'schoolId');
oneToMany(Person, ['registeredTo', 'Registered to'], Firearm, ['firearmsRegistered', 'Registered firearm', 'Registered firearms'], 'registeredToId');
oneToMany(Person, ['custodian', 'Custodian'], Firearm, ['firearmsInCustody', 'Firearm in custody', 'Firearms in custody'], 'custodianId');
oneToMany(Organization, ['registeredAgency', 'Registered agency'], Firearm, ['firearms', 'Firearm', 'Firearms'], 'registeredAgencyId');
oneToMany(Firearm, ['matchedTo', 'Matched to'], EvidenceItem, ['evidenceItems', 'Evidence item', 'Evidence items'], 'matchedFirearmId');
oneToMany(Incident, ['recoveredAt', 'Recovered at'], EvidenceItem, ['evidenceItems', 'Evidence item', 'Evidence items'], 'incidentId');
oneToMany(Location, ['location', 'Location'], Event, ['events', 'Event', 'Events'], 'locationId');
oneToMany(Location, ['location', 'Location'], Incident, ['incidents', 'Incident', 'Incidents'], 'locationId');
oneToMany(School, ['school', 'School'], Incident, ['incidents', 'Incident', 'Incidents'], 'schoolId');
oneToMany(LGU, ['lgu', 'LGU'], Barangay, ['barangays', 'Barangay', 'Barangays'], 'lguId');
oneToMany(LGU, ['lgu', 'LGU'], Facility, ['facilities', 'Facility', 'Facilities'], 'lguId');
oneToMany(LGU, ['lgu', 'LGU'], Contract, ['contracts', 'Contract', 'Contracts'], 'lguId');
oneToMany(Hauler, ['hauler', 'Hauler'], Contract, ['contracts', 'Contract', 'Contracts'], 'haulerId');
oneToMany(Hauler, ['hauler', 'Hauler'], Vehicle, ['vehicles', 'Vehicle', 'Vehicles'], 'haulerId');
oneToMany(Facility, ['facility', 'Facility'], Inspection, ['inspections', 'Inspection', 'Inspections'], 'facilityId');
oneToMany(Hauler, ['hauler', 'Hauler'], Inspection, ['inspections', 'Inspection', 'Inspections'], 'haulerId');
oneToMany(Barangay, ['barangay', 'Barangay'], Complaint, ['complaints', 'Complaint', 'Complaints'], 'barangayId');

// Provenance and relationship ends, the same for every entity type.
for (const [type, plural] of ENTITIES) {
  const single = type.displayName;
  const Plural = cap(plural);
  oneToMany(type, ['canonical', 'Canonical object'], type, ['candidates', 'Candidate', 'Candidates'], 'canonicalId');
  oneToMany(Passage, ['passage', 'Passage'], type, [`mentioned${Plural}`, `Mentioned ${single.toLowerCase()}`, `Mentioned ${type.pluralDisplayName.toLowerCase()}`], 'passageId');
  oneToMany(SourceRecord, ['sourceRecord', 'Source record'], type, [`recorded${Plural}`, `Recorded ${single.toLowerCase()}`, `Recorded ${type.pluralDisplayName.toLowerCase()}`], 'recordId');
  oneToMany(type, [`from${type.apiName}`, `From ${single.toLowerCase()}`], Relationship, ['relationshipsFrom', 'Relationship from', 'Relationships from'], `from${type.apiName}Id`);
  oneToMany(type, [`to${type.apiName}`, `To ${single.toLowerCase()}`], Relationship, ['relationshipsTo', 'Relationship to', 'Relationships to'], `to${type.apiName}Id`);
}

// ---- Actions. Each one writes the audit log (engine/actions.mjs). The primary key is the caller's, so the engine's
// ids (P-001, RS-001) stay readable.

defineCreateObjectAction({ objectType: Person, primaryKeyOption: 'userInput' });
defineCreateObjectAction({ objectType: Resolution, primaryKeyOption: 'userInput' });
defineModifyObjectAction({
  objectType: Relationship,
  excludedProperties: Object.keys(relationshipProps).filter((p) => p !== 'status' && p !== 'reviewNote'),
});
