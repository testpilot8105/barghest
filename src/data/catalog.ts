// The catalog: what the Object Explorer builds every picker from. Read from GET /barghest/catalog (the engine's
// ontology.json plus ontology/ownership.ts), shaped per type, per property and per link.
import type { Catalog, CatalogLink, CatalogProperty, CatalogType, DataType, FilterOp, HistogramKind, Ownership } from './types.ts';

type RawOwnership = Record<string, { default: Ownership; props?: Record<string, Ownership> }>;

export interface RawCatalog {
  ontology: {
    ontology: { rid: string };
    objectTypes: Record<string, RawObjectType>;
  };
  ownership: RawOwnership;
}

interface RawObjectType {
  objectType: {
    apiName: string;
    displayName: string;
    pluralDisplayName: string;
    primaryKey: string;
    titleProperty: string;
    properties: Record<string, { displayName?: string; dataType: { type: string; subType?: { type: string } } }>;
  };
  linkTypes: Array<{ apiName: string; displayName?: string; objectTypeApiName: string; cardinality: 'ONE' | 'MANY' }>;
}

const NOT_ENTITIES = new Set(['Document', 'Passage', 'SourceRecord', 'Relationship', 'Resolution']);

const FILTER_OPS: Record<DataType, FilterOp[]> = {
  string: ['eq', 'in', 'contains', 'isEmpty'],
  integer: ['eq', 'in', 'range', 'isEmpty'],
  double: ['eq', 'in', 'range', 'isEmpty'],
  timestamp: ['range', 'isEmpty'],
  date: ['range', 'isEmpty'],
  boolean: ['eq', 'isEmpty'],
  array: ['contains', 'isEmpty'],
  other: ['isEmpty'],
};

const HISTOGRAM: Record<DataType, HistogramKind | null> = {
  string: 'exact',
  integer: 'ranges',
  double: 'ranges',
  timestamp: 'duration',
  date: 'duration',
  boolean: 'exact',
  array: null,
  other: null,
};

function dataTypeOf(raw: { type: string }): DataType {
  switch (raw.type) {
    case 'string':
    case 'integer':
    case 'double':
    case 'timestamp':
    case 'date':
    case 'boolean':
    case 'array':
      return raw.type;
    case 'long':
    case 'short':
    case 'byte':
      return 'integer';
    case 'float':
    case 'decimal':
      return 'double';
    default:
      return 'other';
  }
}

export function ownershipOf(ownership: RawOwnership, type: string, property?: string): Ownership {
  const entry = ownership[type] ?? ownership['*'] ?? { default: 'source' };
  if (property && entry.props?.[property]) return entry.props[property];
  return entry.default;
}

export function buildCatalog(raw: RawCatalog): Catalog {
  const types: Record<string, CatalogType> = {};
  const order: string[] = [];
  for (const [apiName, def] of Object.entries(raw.ontology.objectTypes)) {
    const ot = def.objectType;
    const properties: CatalogProperty[] = Object.entries(ot.properties).map(([propName, p]) => {
      const dataType = dataTypeOf(p.dataType);
      return {
        apiName: propName,
        displayName: p.displayName ?? propName,
        dataType,
        array: dataType === 'array',
        ownership: ownershipOf(raw.ownership, apiName, propName),
        filterOps: FILTER_OPS[dataType],
        histogram: HISTOGRAM[dataType],
        hidden: apiName === 'Relationship' && /^(from|to)[A-Z].*Id$/.test(propName) && propName !== 'fromId' && propName !== 'toId',
      };
    });
    const links: CatalogLink[] = def.linkTypes.map((l) => ({
      apiName: l.apiName,
      displayName: l.displayName ?? l.apiName,
      targetType: l.objectTypeApiName,
      cardinality: l.cardinality === 'ONE' ? 'one' : 'many',
    }));
    types[apiName] = {
      apiName,
      displayName: ot.displayName,
      pluralDisplayName: ot.pluralDisplayName || ot.displayName,
      primaryKey: ot.primaryKey,
      titleProperty: ot.titleProperty,
      ownership: ownershipOf(raw.ownership, apiName),
      entity: !NOT_ENTITIES.has(apiName),
      properties,
      links,
    };
    order.push(apiName);
  }
  return { ontologyRid: raw.ontology.ontology.rid, order, types };
}

export function propertyOf(catalog: Catalog, type: string, property: string): CatalogProperty | undefined {
  return catalog.types[type]?.properties.find((p) => p.apiName === property);
}

export function linkOf(catalog: Catalog, type: string, link: string): CatalogLink | undefined {
  return catalog.types[type]?.links.find((l) => l.apiName === link);
}
