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

/** What `POST import` answers. `extraction` says whether the model started reading the file. */
export interface ImportResult {
  documentId: string;
  format: string;
  passages: number;
  records: number;
  pages: number | null;
  chars: number;
  /** `no text` when the file yielded no characters (a scanned PDF, an empty file); nothing is read then. */
  status: 'imported' | 'no text';
  /** The stored original, relative to the app; `fileUrl` serves it. */
  path: string;
  extraction: 'started' | 'running' | 'off' | 'no text';
}

export interface ImportRequest {
  file: File;
  /** The investigation the file belongs to (its id, never a name). */
  investigation: string;
  /** The register the file comes from, shown as the Document's `system`. */
  system?: string;
  /** The folder it lands in; the top level when empty. Read by the engine once folders exist. */
  folderId?: string;
  /** `false` stores the file without the model reading it. */
  extract?: boolean;
}

export interface ExtractResult {
  documentId: string;
  extraction: 'started' | 'running';
}

/** One model call, as the engine logged it. */
export interface InferenceRow {
  id: number;
  at: string;
  model: string;
  purpose: string;
  documentId: string | null;
  passageId: string | null;
  promptHash: string;
  latencyMs: number;
  promptTokens: number | null;
  outputTokens: number | null;
  ok: boolean;
}

export interface OllamaHealth {
  up: boolean;
  host: string;
  models: string[];
  chat?: boolean;
  embed?: boolean;
  error?: string;
}

/** An object the model pulled from a passage or a table row. A mention has no confidence of its own; links do. */
export interface DocumentMention {
  type: string;
  pk: string;
  title: string;
  canonicalId: string | null;
}

/** A link cited by a passage, with its ends as the passage names them. */
export interface DocumentRelationship {
  pk: string;
  kind: string;
  /** The passage's own words for a related_to link; empty otherwise. */
  kindLabel: string;
  label: string;
  from: { type: string; pk: string; title: string };
  to: { type: string; pk: string; title: string };
  confidence: number | null;
  status: string;
  method: string;
}

export interface DocumentPassage {
  pk: string;
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  mentions: DocumentMention[];
  relationships: DocumentRelationship[];
}

export interface DocumentRecord {
  pk: string;
  label: string;
  observedAt: string | null;
  system: string;
  mentions: DocumentMention[];
}

/** The file view in one call. */
export interface DocumentView {
  document: {
    documentId: string;
    title: string;
    path: string;
    format: string;
    system: string;
    scenario: string;
    importedAt: string;
    status: string;
    /** True while the model is reading this file; the hook keeps asking until it is false. */
    extracting: boolean;
  };
  /** Null until folders land (step 6). */
  folder: { id: string; name: string } | null;
  passages: DocumentPassage[];
  records: DocumentRecord[];
  /** This document's model log, oldest first. */
  inference: InferenceRow[];
}

/** What `POST delete-document` answers: what went with the file, and what the re-run of resolution wrote. */
export interface DeleteResult {
  documentId: string;
  removed: {
    passages: number;
    records: number;
    mentions: number;
    relationships: number;
    resolutions: number;
    embeddings: number;
    storedFile: boolean;
  };
  /** Relationships also cited by another file, which only lost this file's passage ids. */
  trimmedRelationships: number;
  resolved: { written: number; repointedRelationships: number } | null;
}

/** One kind of thing the model can be asked to list, and the ontology type it lands as. */
export interface InvestigationBlock {
  id: string;
  label: string;
  types: string[];
}

export interface InvestigationTemplate {
  id: string;
  name: string;
  blocks: string[];
}

/** A store record, not an ontology object. The id never changes; the name is a label on it. */
export interface Investigation {
  id: string;
  name: string;
  template: string | null;
  blocks: string[];
  documents: number;
  createdAt: string;
}

export interface InvestigationsResult {
  investigations: Investigation[];
  templates: InvestigationTemplate[];
  blocks: InvestigationBlock[];
}

export interface CreateInvestigationRequest {
  name: string;
  /** One of the template ids; `general` when neither this nor `blocks` is given. */
  template?: string;
  /** Block ids; when given they win over the template. */
  blocks?: string[];
}

export interface Health {
  ok: boolean;
  engine: string;
  ontology: { rid: string; types: number; objects: Record<string, number> };
  /** `null` while the model is off for this engine. */
  ollama: OllamaHealth | null;
  /** The model names, or an empty list with the model off. */
  models: { chat: string; embed: string } | [];
  /** Document ids the model is reading right now. */
  extracting: string[];
  /** File extensions `import` accepts. */
  formats: string[];
}
