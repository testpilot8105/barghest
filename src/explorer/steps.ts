// The words for each step of an exploration, in Gotham's phrasing ("Keeping objects with Platform property values
// matching any of Discord"), and the filter a set of picked histogram buckets becomes. Pure functions over the catalog.
import { linkOf, propertyOf, typeAt, type Catalog, type CatalogProperty, type Exploration, type Filter, type HistogramKind } from '../data/index.ts';

/** A sentence with its names picked out: plain text, and the parts shown in bold. */
export type Phrase = Array<string | { strong: string }>;

/** The bucket the data layer gives objects with no value. */
export const EMPTY_BUCKET = '(empty)';

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO = /^\d{4}-\d{2}-\d{2}T/;
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function number(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** A property value as the screens show it: dates as dates, lists joined, numbers rounded. */
export function showValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(showValue).join(', ');
  if (typeof value === 'number') return number(value);
  if (typeof value === 'string' && ISO.test(value)) return dateFormat.format(new Date(value));
  return String(value);
}

/** A histogram bucket's label as shown: a day for date buckets, rounded bounds for number ranges. */
export function bucketLabel(kind: HistogramKind, bucket: string): string {
  if (bucket === EMPTY_BUCKET) return 'No value';
  if (kind === 'duration' && ISO.test(bucket)) return dateFormat.format(new Date(bucket));
  const range = /^(.+) to (.+)$/.exec(bucket);
  if (kind === 'ranges' && range) return `${number(Number(range[1]))} to ${number(Number(range[2]))}`;
  return bucket;
}

function typeName(catalog: Catalog, type: string): string {
  return catalog.types[type]?.displayName ?? type;
}

function propertyName(catalog: Catalog, type: string, property: string): string {
  return propertyOf(catalog, type, property)?.displayName ?? property;
}

/** What the set is, in words: the types the path walks through, "People › Digital accounts"; "All objects" before a
 *  type is picked. The menu bar and the dock both name the set this way (owner, 09.10.2026: "New exploration" said
 *  nothing about what was on screen). */
export function setName(catalog: Catalog, exp: Exploration | null): string {
  if (!exp) return 'All objects';
  const types = [exp.start, ...exp.steps.flatMap((_, i) => ('pivot' in exp.steps[i] ? [typeAt(catalog, exp, i + 1)] : []))];
  return types.map((t) => catalog.types[t]?.pluralDisplayName ?? t).join(' › ');
}

export function startPhrase(catalog: Catalog, type: string): Phrase {
  return ['Keeping objects matching any of ', { strong: typeName(catalog, type) }];
}

export function filterPhrase(catalog: Catalog, type: string, filter: Filter): Phrase {
  const name = { strong: propertyName(catalog, type, filter.property) };
  switch (filter.op) {
    case 'eq':
    case 'in':
      return ['Keeping objects with ', name, ' property values matching any of ', { strong: showValue(filter.value) }];
    case 'contains':
      return ['Keeping objects with ', name, ' containing ', { strong: showValue(filter.value) }];
    case 'isEmpty':
      return ['Keeping objects with no ', name];
    case 'range': {
      const { min, max } = (filter.value ?? {}) as { min?: unknown; max?: unknown };
      if (min != null && max != null) return ['Keeping objects with ', name, ' between ', { strong: showValue(min) }, ' and ', { strong: showValue(max) }];
      if (min != null) return ['Keeping objects with ', name, ' from ', { strong: showValue(min) }];
      return ['Keeping objects with ', name, ' up to ', { strong: showValue(max) }];
    }
  }
}

export function pivotPhrase(catalog: Catalog, type: string, linkName: string): Phrase {
  const link = linkOf(catalog, type, linkName);
  const target = link ? (catalog.types[link.targetType]?.pluralDisplayName ?? link.targetType) : linkName;
  return ['Searching around to ', { strong: target }, ' through ', { strong: link?.displayName ?? linkName }];
}

/** The sentence for step `index` of an exploration. */
export function stepPhrase(catalog: Catalog, exp: Exploration, index: number): Phrase {
  const step = exp.steps[index];
  const type = typeAt(catalog, exp, index);
  return 'pivot' in step ? pivotPhrase(catalog, type, step.pivot) : filterPhrase(catalog, type, step.filter);
}

/** Exact buckets combine (any of); a number range or a day is one bucket at a time. */
export function multiSelect(kind: HistogramKind): boolean {
  return kind === 'exact';
}

function coerce(prop: CatalogProperty, bucket: string): unknown {
  if (prop.dataType === 'boolean') return bucket === 'true';
  if (prop.dataType === 'integer' || prop.dataType === 'double') return Number(bucket);
  return bucket;
}

/** The filter the picked buckets become: "No value" is isEmpty, a day or a number range is range, the rest eq or in. */
export function filterFor(prop: CatalogProperty, kind: HistogramKind, picked: string[]): Filter | null {
  if (!picked.length) return null;
  const property = prop.apiName;
  if (picked.includes(EMPTY_BUCKET)) return { property, op: 'isEmpty' };
  if (kind === 'duration' && ISO.test(picked[0])) {
    const start = new Date(picked[0]).getTime();
    return { property, op: 'range', value: { min: new Date(start).toISOString(), max: new Date(start + DAY_MS - 1).toISOString() } };
  }
  const range = /^(.+) to (.+)$/.exec(picked[0]);
  if (kind === 'ranges' && range) return { property, op: 'range', value: { min: Number(range[1]), max: Number(range[2]) } };
  const values = picked.map((b) => coerce(prop, b));
  return values.length === 1 ? { property, op: 'eq', value: values[0] } : { property, op: 'in', value: values };
}
