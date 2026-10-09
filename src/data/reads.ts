// The reads, one call each, generic across types: nothing here is written for a specific type. Every function
// takes the connection first so the proofs can run them under Node with the real client over HTTP.
import { linkOf, propertyOf } from './catalog.ts';
import { engineGet, objectSet, type DataClient } from './client.ts';
import { currentType, typeAt } from './exploration.ts';
import type {
  AuditEntry,
  Bucket,
  Exploration,
  Filter,
  Histogram,
  HistogramKind,
  LinkGroup,
  ObjectView,
  Page,
  PassageView,
  Ref,
  RelationshipView,
  ResolutionView,
  Row,
  SearchAllEntry,
  SearchAroundEntry,
} from './types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const BUCKET_CAP = 20;

/** An OSDK where clause for one filter. `contains` on text is substring search (all faux has); on an array it is
 * membership. `range` takes `{ min?, max? }`. */
export function toWhere(filter: Filter, isArray: boolean): Record<string, unknown> {
  const { property, op, value } = filter;
  switch (op) {
    case 'eq':
      return { [property]: { $eq: value } };
    case 'in':
      return { [property]: { $in: Array.isArray(value) ? value : [value] } };
    case 'contains':
      return isArray ? { [property]: { $contains: value } } : { [property]: { $containsAllTermsInOrder: String(value) } };
    case 'range': {
      // One clause per bound: the client refuses two operators under one property.
      const r = (value ?? {}) as { min?: unknown; max?: unknown };
      const bounds: Array<Record<string, unknown>> = [];
      if (r.min != null) bounds.push({ [property]: { $gte: r.min } });
      if (r.max != null) bounds.push({ [property]: { $lte: r.max } });
      if (bounds.length === 1) return bounds[0];
      if (bounds.length === 0) return { [property]: { $isNull: false } };
      return { $and: bounds };
    }
    case 'isEmpty':
      return { [property]: { $isNull: true } };
  }
}

/** Apply the exploration's steps to an object set. */
export function toObjectSet(dc: DataClient, exp: Exploration): { os: Any; type: string } {
  let type = exp.start;
  let os: Any = objectSet(dc, type);
  exp.steps.forEach((step, i) => {
    if ('pivot' in step) {
      const link = linkOf(dc.catalog, type, step.pivot);
      if (!link) throw new Error(`${type} has no link ${step.pivot}`);
      os = os.pivotTo(step.pivot);
      type = link.targetType;
    } else {
      const prop = propertyOf(dc.catalog, typeAt(dc.catalog, exp, i), step.filter.property);
      os = os.where(toWhere(step.filter, prop?.array ?? false));
    }
  });
  return { os, type };
}

function toRow(obj: Any): Row {
  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (!k.startsWith('$')) properties[k] = v;
  return { pk: String(obj.$primaryKey), title: obj.$title ?? String(obj.$primaryKey), properties };
}

export async function fetchRows(dc: DataClient, exp: Exploration, pageToken?: string): Promise<Page> {
  const { os } = toObjectSet(dc, exp);
  const args: Record<string, unknown> = { $pageSize: exp.pageSize ?? 50 };
  if (pageToken) args.$nextPageToken = pageToken;
  if (exp.sort) args.$orderBy = { [exp.sort.property]: exp.sort.direction };
  const page = await os.fetchPage(args);
  return { rows: page.data.map(toRow), nextPageToken: page.nextPageToken ?? undefined };
}

export async function countRows(dc: DataClient, exp: Exploration): Promise<number> {
  const { os } = toObjectSet(dc, exp);
  const r = await os.aggregate({ $select: { $count: 'unordered' } });
  return Number(r.$count ?? 0);
}

async function minMax(os: Any, property: string): Promise<{ min: number; max: number } | null> {
  const r = await os.aggregate({ $select: { [`${property}:min`]: 'unordered', [`${property}:max`]: 'unordered' } });
  const min = r[property]?.min;
  const max = r[property]?.max;
  if (min == null || max == null) return null;
  return { min: Number(new Date(min).getTime() || min), max: Number(new Date(max).getTime() || max) };
}

export async function histogram(dc: DataClient, exp: Exploration, property: string): Promise<Histogram> {
  const { os, type } = toObjectSet(dc, exp);
  const prop = propertyOf(dc.catalog, type, property);
  const kind: HistogramKind = prop?.histogram ?? 'exact';
  let groupBy: Record<string, unknown>;
  if (kind === 'ranges') {
    const mm = await minMax(os, property);
    if (!mm || mm.min === mm.max) groupBy = { [property]: 'exact' };
    else {
      const width = (mm.max - mm.min) / 10;
      const ranges = Array.from({ length: 10 }, (_, i) => ({ startValue: mm.min + i * width, endValue: i === 9 ? mm.max + 1e-9 : mm.min + (i + 1) * width }));
      groupBy = { [property]: { $ranges: ranges } };
    }
  } else if (kind === 'duration') {
    groupBy = { [property]: { $duration: [1, 'days'] } };
  } else {
    groupBy = { [property]: 'exact' };
  }
  const groups: Any[] = await os.aggregate({ $select: { $count: 'unordered' }, $groupBy: groupBy });
  const all: Bucket[] = groups.map((g) => {
    const v = g.$group?.[property];
    const label = v == null ? '(empty)' : typeof v === 'object' ? `${v.startValue ?? ''} to ${v.endValue ?? ''}` : String(v);
    return { bucket: label, count: Number(g.$count ?? 0) };
  });
  if (kind === 'exact') all.sort((a, b) => b.count - a.count || a.bucket.localeCompare(b.bucket));
  const buckets = all.slice(0, BUCKET_CAP);
  const other = all.slice(BUCKET_CAP).reduce((n, b) => n + b.count, 0);
  const total = all.reduce((n, b) => n + b.count, 0);
  return { property, kind, buckets, other, total };
}

export async function searchAround(dc: DataClient, exp: Exploration): Promise<SearchAroundEntry[]> {
  const { os, type } = toObjectSet(dc, exp);
  const links = dc.catalog.types[type]?.links ?? [];
  return Promise.all(
    links.map(async (link) => {
      const r = await os.pivotTo(link.apiName).aggregate({ $select: { $count: 'unordered' } });
      return { link: link.apiName, displayName: link.displayName, targetType: link.targetType, count: Number(r.$count ?? 0) };
    }),
  );
}

export async function toRefs(dc: DataClient, exp: Exploration, limit = 200): Promise<Ref[]> {
  const { os, type } = toObjectSet(dc, exp);
  const pkProp = dc.catalog.types[type].primaryKey;
  const page = await os.fetchPage({ $pageSize: limit, $select: [pkProp] });
  return page.data.map((o: Any) => ({ type, pk: String(o.$primaryKey) }));
}

async function titlesOf(dc: DataClient, refs: Ref[]): Promise<Map<string, string>> {
  const byType = new Map<string, Set<string>>();
  for (const r of refs) {
    if (!byType.has(r.type)) byType.set(r.type, new Set());
    byType.get(r.type)!.add(r.pk);
  }
  const titles = new Map<string, string>();
  await Promise.all(
    [...byType].map(async ([type, pks]) => {
      const pkProp = dc.catalog.types[type]?.primaryKey;
      if (!pkProp) return;
      const page = await objectSet(dc, type).where({ [pkProp]: { $in: [...pks] } }).fetchPage({ $pageSize: pks.size });
      for (const o of page.data) titles.set(`${type}:${o.$primaryKey}`, o.$title ?? String(o.$primaryKey));
    }),
  );
  return titles;
}

async function passagesOf(dc: DataClient, ids: string[]): Promise<Map<string, PassageView>> {
  const out = new Map<string, PassageView>();
  if (!ids.length) return out;
  const page = await objectSet(dc, 'Passage').where({ passageId: { $in: ids } }).fetchPage({ $pageSize: ids.length });
  for (const p of page.data) out.set(String(p.passageId), { pk: String(p.passageId), documentId: String(p.documentId ?? ''), label: String(p.label ?? ''), text: String(p.text ?? '') });
  return out;
}

async function relationshipViews(dc: DataClient, rels: Any[], direction: 'out' | 'in'): Promise<RelationshipView[]> {
  const otherRefs: Ref[] = rels.map((r) => (direction === 'out' ? { type: r.toType, pk: r.toId } : { type: r.fromType, pk: r.fromId }));
  const [titles, passages] = await Promise.all([
    titlesOf(dc, otherRefs.filter((r) => r.type && r.pk)),
    passagesOf(dc, [...new Set(rels.flatMap((r) => (r.passageIds ?? []) as string[]))]),
  ]);
  return rels.map((r, i) => ({
    pk: String(r.relationshipId),
    label: String(r.label ?? ''),
    kind: String(r.kind ?? ''),
    confidence: r.confidence == null ? null : Number(r.confidence),
    status: String(r.status ?? ''),
    method: String(r.method ?? ''),
    observedAt: r.observedAt ?? null,
    otherType: otherRefs[i].type,
    otherPk: otherRefs[i].pk,
    otherTitle: titles.get(`${otherRefs[i].type}:${otherRefs[i].pk}`) ?? otherRefs[i].pk,
    passages: ((r.passageIds ?? []) as string[]).map((id) => passages.get(id) ?? { pk: id, documentId: '', label: id, text: '' }),
  }));
}

export async function getObjectView(dc: DataClient, type: string, pk: string): Promise<ObjectView> {
  const def = dc.catalog.types[type];
  if (!def) throw new Error(`unknown type ${type}`);
  const self = objectSet(dc, type).where({ [def.primaryKey]: { $eq: pk } });
  const obj = await objectSet(dc, type).fetchOne(pk);

  const properties = def.properties
    .filter((p) => !p.hidden || obj[p.apiName] != null)
    .map((p) => ({ apiName: p.apiName, displayName: p.displayName, value: obj[p.apiName] ?? null, ownership: p.ownership }));

  const links: LinkGroup[] = await Promise.all(
    def.links.map(async (link) => {
      const pivot = self.pivotTo(link.apiName);
      const [count, page] = await Promise.all([pivot.aggregate({ $select: { $count: 'unordered' } }), pivot.fetchPage({ $pageSize: 5 })]);
      return {
        link: link.apiName,
        displayName: link.displayName,
        targetType: link.targetType,
        count: Number(count.$count ?? 0),
        first: page.data.map((o: Any) => ({ pk: String(o.$primaryKey), title: o.$title ?? String(o.$primaryKey) })),
      };
    }),
  );

  let out: RelationshipView[] = [];
  let into: RelationshipView[] = [];
  let candidates: ObjectView['candidates'] = [];
  let canonical: ObjectView['canonical'] = null;
  if (def.entity) {
    const [fromPage, toPage, candPage] = await Promise.all([
      self.pivotTo('relationshipsFrom').fetchPage({ $pageSize: 100 }),
      self.pivotTo('relationshipsTo').fetchPage({ $pageSize: 100 }),
      self.pivotTo('candidates').fetchPage({ $pageSize: 100 }),
    ]);
    [out, into] = await Promise.all([relationshipViews(dc, fromPage.data, 'out'), relationshipViews(dc, toPage.data, 'in')]);
    candidates = candPage.data.map((o: Any) => ({ pk: String(o.$primaryKey), title: o.$title ?? String(o.$primaryKey), passageId: o.passageId ?? null }));
    if (obj.canonicalId) {
      const c = await objectSet(dc, type).fetchOne(obj.canonicalId).catch(() => null);
      canonical = c ? { pk: String(c.$primaryKey), title: c.$title ?? String(c.$primaryKey) } : { pk: String(obj.canonicalId), title: String(obj.canonicalId) };
    }
  }

  const ref = `${type}:${pk}`;
  const ownPassageIds: string[] = Array.isArray(obj.passageIds) ? obj.passageIds : obj.passageId ? [String(obj.passageId)] : [];
  const [resPage, audit, ownPassages] = await Promise.all([
    objectSet(dc, 'Resolution').fetchPage({ $pageSize: 500 }),
    engineGet<AuditEntry[]>(dc, '/barghest/audit', { objectId: ref }),
    passagesOf(dc, ownPassageIds),
  ]);
  const resolutions: ResolutionView[] = resPage.data
    .filter((r: Any) => (r.canonicalType === type && r.canonicalId === pk) || ((r.candidateIds ?? []) as string[]).includes(ref))
    .map((r: Any) => ({
      pk: String(r.resolutionId),
      label: String(r.label ?? ''),
      decision: String(r.decision ?? ''),
      confidence: r.confidence == null ? null : Number(r.confidence),
      decidedBy: String(r.decidedBy ?? ''),
      method: String(r.method ?? ''),
      reason: String(r.reason ?? ''),
      candidateIds: (r.candidateIds ?? []) as string[],
      canonicalType: String(r.canonicalType ?? ''),
      canonicalId: String(r.canonicalId ?? ''),
    }));

  return {
    type,
    pk,
    title: obj.$title ?? pk,
    properties,
    links,
    relationships: { out, in: into },
    passages: ownPassageIds.map((id) => ownPassages.get(id) ?? { pk: id, documentId: '', label: id, text: '' }),
    canonical,
    candidates,
    resolutions,
    audit,
  };
}

export async function searchAll(dc: DataClient, text: string): Promise<Record<string, SearchAllEntry>> {
  const q = text.trim();
  const entries = await Promise.all(
    dc.catalog.order.map(async (type) => {
      const def = dc.catalog.types[type];
      if (!q) return [type, { count: 0, top: [] }] as const;
      const os = objectSet(dc, type).where({ [def.titleProperty]: { $containsAllTermsInOrder: q } });
      const [count, page] = await Promise.all([
        os.aggregate({ $select: { $count: 'unordered' } }),
        os.fetchPage({ $pageSize: 5, $orderBy: { [def.titleProperty]: 'asc' } }),
      ]);
      return [type, { count: Number(count.$count ?? 0), top: page.data.map((o: Any) => ({ pk: String(o.$primaryKey), title: o.$title ?? String(o.$primaryKey) })) }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export { currentType };
