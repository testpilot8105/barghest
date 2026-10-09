// The shapes the Object Explorer data layer hands to the screens. Nothing from @osdk appears here.

export type Ownership = 'source' | 'ontology' | 'derived';
export type FilterOp = 'eq' | 'in' | 'contains' | 'range' | 'isEmpty';
export type HistogramKind = 'exact' | 'ranges' | 'duration';
export type DataType = 'string' | 'integer' | 'double' | 'timestamp' | 'date' | 'boolean' | 'array' | 'other';

export interface CatalogProperty {
  apiName: string;
  displayName: string;
  dataType: DataType;
  array: boolean;
  ownership: Ownership;
  filterOps: FilterOp[];
  histogram: HistogramKind | null;
  /** Generated plumbing (the Relationship end keys): keep out of pickers unless asked for. */
  hidden: boolean;
}

export interface CatalogLink {
  apiName: string;
  displayName: string;
  targetType: string;
  cardinality: 'one' | 'many';
}

export interface CatalogType {
  apiName: string;
  displayName: string;
  pluralDisplayName: string;
  primaryKey: string;
  titleProperty: string;
  ownership: Ownership;
  /** True for the types a Relationship can connect and resolution can merge (Person, Firearm, Hauler...). */
  entity: boolean;
  properties: CatalogProperty[];
  links: CatalogLink[];
}

export interface Catalog {
  ontologyRid: string;
  /** Types in display order. */
  order: string[];
  types: Record<string, CatalogType>;
}

export interface Filter {
  property: string;
  op: FilterOp;
  /** `eq` and `contains`: one value. `in`: a list. `range`: `{ min?, max? }`. `isEmpty`: nothing. */
  value?: unknown;
}

export type Step = { filter: Filter } | { pivot: string };

export interface Exploration {
  start: string;
  steps: Step[];
  sort?: { property: string; direction: 'asc' | 'desc' };
  pageSize?: number;
}

export interface Row {
  pk: string;
  title: string;
  properties: Record<string, unknown>;
}

export interface Page {
  rows: Row[];
  nextPageToken?: string;
}

export interface Bucket {
  bucket: string;
  count: number;
}

export interface Histogram {
  property: string;
  kind: HistogramKind;
  buckets: Bucket[];
  other: number;
  total: number;
}

export interface SearchAroundEntry {
  link: string;
  displayName: string;
  targetType: string;
  count: number;
}

export interface Ref {
  type: string;
  pk: string;
}

export interface PropertyValue {
  apiName: string;
  displayName: string;
  value: unknown;
  ownership: Ownership;
}

export interface LinkGroup {
  link: string;
  displayName: string;
  targetType: string;
  count: number;
  first: Array<{ pk: string; title: string }>;
}

export interface PassageView {
  pk: string;
  documentId: string;
  label: string;
  text: string;
}

export interface RelationshipView {
  pk: string;
  label: string;
  kind: string;
  confidence: number | null;
  status: string;
  method: string;
  observedAt: string | null;
  otherType: string;
  otherPk: string;
  otherTitle: string;
  passages: PassageView[];
}

export interface ResolutionView {
  pk: string;
  label: string;
  decision: string;
  confidence: number | null;
  decidedBy: string;
  method: string;
  reason: string;
  candidateIds: string[];
  canonicalType: string;
  canonicalId: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  action: string;
  actor: string;
  outcome: string;
  params: Record<string, unknown>;
  edits: unknown[];
  objectIds: string[];
}

export interface ObjectView {
  type: string;
  pk: string;
  title: string;
  properties: PropertyValue[];
  links: LinkGroup[];
  relationships: { out: RelationshipView[]; in: RelationshipView[] };
  /** The object's own evidence: a Relationship's passageIds, or the passage an extracted candidate came from. */
  passages: PassageView[];
  canonical: { pk: string; title: string } | null;
  candidates: Array<{ pk: string; title: string; passageId: string | null }>;
  resolutions: ResolutionView[];
  audit: AuditEntry[];
}

export interface SearchAllEntry {
  count: number;
  top: Array<{ pk: string; title: string }>;
}
