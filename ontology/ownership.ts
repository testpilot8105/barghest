// Who owns each property: `source` is what a document or register said (never edited through the app), `ontology`
// is what the app decided (resolution, review, notes), `derived` is computed from the rest. The catalog shows it;
// actions refuse writes to `source` fields. Plain data, erasable TypeScript: the engine imports it directly under
// Node, the data layer gets it through GET /barghest/catalog.
export type Ownership = 'source' | 'ontology' | 'derived';

export type TypeOwnership = { default: Ownership; props?: Record<string, Ownership> };

// '*' is every entity type (Person, Firearm, Hauler and the rest): extracted values are source-backed, the
// provenance fields are the app's.
export const ownership: Record<string, TypeOwnership> = {
  '*': { default: 'source', props: { canonicalId: 'ontology', passageId: 'ontology', recordId: 'ontology', scenario: 'ontology', photoId: 'ontology' } },
  Document: { default: 'source', props: { status: 'ontology', importedAt: 'ontology', scenario: 'ontology', folderId: 'ontology', name: 'ontology', register: 'ontology' } },
  Passage: { default: 'source' },
  SourceRecord: { default: 'source' },
  Relationship: { default: 'ontology', props: { confidence: 'derived', passageIds: 'source', recordIds: 'source', observedAt: 'source' } },
  Resolution: { default: 'ontology' },
};

export function ownershipOf(type: string, property: string): Ownership {
  const entry = ownership[type] ?? ownership['*'];
  return entry.props?.[property] ?? entry.default;
}
