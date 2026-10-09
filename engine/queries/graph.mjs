// Graph queries over faux's links, deterministic: what connects two objects (breadth-first, shortest path) and the
// timeline around one object (everything dated within a few hops, tagged observed, system or analyst). Both walk
// entity types and Relationship objects only; documents, passages, source records and resolutions are evidence,
// not nodes, and come back as the passages behind the edges.

const EVIDENCE_TYPES = new Set(['Document', 'Passage', 'SourceRecord', 'Resolution']);
// Links that lead to evidence or to the same real thing, never across to another thing.
const SKIP_LINKS = new Set(['passage', 'sourceRecord', 'document', 'passages', 'records']);

const key = (o) => `${o.__apiName}:${o.__primaryKey}`;
const parseKey = (s) => {
  const i = s.indexOf(':');
  return i < 0 ? null : { type: s.slice(0, i), pk: s.slice(i + 1) };
};

function linkNamesOf(meta, type) {
  return (meta.objectTypes[type]?.linkTypes ?? []).filter((l) => !SKIP_LINKS.has(l.apiName) && !EVIDENCE_TYPES.has(l.objectTypeApiName)).map((l) => l.apiName);
}

function neighbours(data, meta, obj) {
  const out = [];
  for (const link of linkNamesOf(meta, obj.__apiName)) {
    let linked;
    try {
      linked = data.getLinksOrThrow(obj.__apiName, obj.__primaryKey, link);
    } catch {
      continue;
    }
    for (const n of linked) if (!EVIDENCE_TYPES.has(n.__apiName)) out.push({ obj: n, link });
  }
  return out;
}

function summarise(o) {
  return { type: o.__apiName, pk: String(o.__primaryKey), title: o.__title ?? String(o.__primaryKey) };
}

function relationshipSummary(r) {
  return {
    pk: String(r.__primaryKey),
    label: r.label ?? '',
    kind: r.kind ?? '',
    confidence: r.confidence ?? null,
    status: r.status ?? '',
    method: r.method ?? '',
    observedAt: r.observedAt ?? null,
    from: { type: r.fromType, pk: r.fromId },
    to: { type: r.toType, pk: r.toId },
    passageIds: r.passageIds ?? [],
  };
}

function passagesFor(data, ids) {
  const out = [];
  for (const id of new Set(ids)) {
    const p = data.getObject('Passage', id);
    if (p) out.push({ pk: String(p.__primaryKey), documentId: p.documentId ?? '', label: p.label ?? '', text: p.text ?? '' });
  }
  return out;
}

/**
 * What connects two objects ("Type:pk"): the shortest paths through links and Relationship objects, up to
 * `maxPaths` of them and no longer than the shortest plus `slack`, so "same school" and "took the firearm that was
 * recovered at the scene" both come back when both are true. The union of their objects, relationships and
 * passages is returned beside the paths themselves.
 */
export function whatConnects(data, meta, fromId, toId, { maxDepth = 8, maxPaths = 5, slack = 2 } = {}) {
  const from = parseKey(fromId);
  const to = parseKey(toId);
  if (!from || !to) throw Object.assign(new Error('from and to must be Type:pk'), { status: 400 });
  const start = data.getObject(from.type, from.pk);
  const goal = data.getObject(to.type, to.pk);
  if (!start || !goal) throw Object.assign(new Error(`object not found: ${!start ? fromId : toId}`), { status: 404 });

  const goalKey = key(goal);
  const found = [];
  let shortest = null;
  // Breadth-first over simple paths; the frontier holds paths, not nodes, so parallel routes survive.
  let frontier = [[{ k: key(start), link: null }]];
  const seenAtDepth = new Map([[key(start), 0]]);
  for (let depth = 0; frontier.length && depth < maxDepth; depth++) {
    if (shortest !== null && depth > shortest + slack) break;
    const next = [];
    for (const path of frontier) {
      const last = parseKey(path[path.length - 1].k);
      const obj = data.getObject(last.type, last.pk);
      if (!obj) continue;
      for (const { obj: n, link } of neighbours(data, meta, obj)) {
        const k = key(n);
        if (path.some((p) => p.k === k)) continue;
        const extended = [...path, { k, link }];
        if (k === goalKey) {
          if (shortest === null) shortest = depth;
          found.push(extended);
          if (found.length >= maxPaths) break;
          continue;
        }
        // Prune routes that reach a node much later than another route did; keeps the search small.
        const best = seenAtDepth.get(k);
        if (best !== undefined && depth + 1 > best + slack) continue;
        if (best === undefined) seenAtDepth.set(k, depth + 1);
        next.push(extended);
      }
      if (found.length >= maxPaths) break;
    }
    if (found.length >= maxPaths) break;
    frontier = next;
  }

  const objects = new Map();
  const relationships = new Map();
  const paths = found.map((path) => {
    const pObjects = [];
    const pRelationships = [];
    const steps = [];
    path.forEach((step, i) => {
      const { type, pk } = parseKey(step.k);
      const o = data.getObject(type, pk);
      if (type === 'Relationship') {
        const r = relationshipSummary(o);
        pRelationships.push(r);
        relationships.set(step.k, r);
      } else {
        const s = summarise(o);
        pObjects.push(s);
        objects.set(step.k, s);
      }
      if (i > 0) steps.push({ from: path[i - 1].k, link: step.link, to: step.k });
    });
    return { hops: pObjects.length - 1, objects: pObjects, relationships: pRelationships, steps };
  });
  const passages = passagesFor(data, [...relationships.values()].flatMap((r) => r.passageIds));
  return {
    from: fromId,
    to: toId,
    found: paths.length > 0,
    hops: paths.length ? paths[0].hops : null,
    paths,
    objects: [...objects.values()],
    relationships: [...relationships.values()],
    passages,
  };
}

/** Everything dated within `hops` of an object, in time order. A Relationship between two objects is one hop. */
export function timeline(data, meta, store, objectId, { hops = 2 } = {}) {
  const ref = parseKey(objectId);
  if (!ref) throw Object.assign(new Error('objectId must be Type:pk'), { status: 400 });
  const start = data.getObject(ref.type, ref.pk);
  if (!start) throw Object.assign(new Error(`object not found: ${objectId}`), { status: 404 });

  // Reach: entity objects within `hops`; Relationship objects are transparent (through them costs nothing extra).
  const depth = new Map([[key(start), 0]]);
  const relationships = new Map();
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const obj of frontier) {
      const d = depth.get(key(obj));
      for (const { obj: n } of neighbours(data, meta, obj)) {
        if (n.__apiName === 'Relationship') {
          if (!relationships.has(key(n))) relationships.set(key(n), n);
          // Step through to the far end at the cost of one hop.
          const ends = [[n.fromType, n.fromId], [n.toType, n.toId]].filter(([t, pk]) => t && pk && `${t}:${pk}` !== key(obj));
          for (const [t, pk] of ends) {
            const far = data.getObject(t, pk);
            const dd = d + 1;
            if (far && (!depth.has(key(far)) || depth.get(key(far)) > dd) && dd <= hops) {
              depth.set(key(far), dd);
              next.push(far);
            }
          }
          continue;
        }
        const dd = d + 1;
        if ((!depth.has(key(n)) || depth.get(key(n)) > dd) && dd <= hops) {
          depth.set(key(n), dd);
          next.push(n);
        }
      }
    }
    frontier = next;
  }

  const reach = new Set(depth.keys());
  const events = [];
  for (const r of relationships.values()) {
    if (!r.observedAt) continue;
    events.push({
      id: key(r),
      at: r.observedAt,
      kind: r.kind ?? 'relationship',
      summary: r.label ?? '',
      tag: r.method === 'system' ? 'system' : 'observed',
      confidence: r.confidence ?? null,
      status: r.status ?? '',
      objectIds: [`${r.fromType}:${r.fromId}`, `${r.toType}:${r.toId}`],
      passageIds: r.passageIds ?? [],
    });
  }
  for (const k of reach) {
    const { type, pk } = parseKey(k);
    const o = data.getObject(type, pk);
    if (!o) continue;
    const at = o.occurredAt ?? o.startAt ?? o.filedAt ?? o.inspectedAt ?? null;
    if (!at) continue;
    events.push({
      id: k,
      at,
      kind: type.toLowerCase(),
      summary: o.__title ?? pk,
      tag: 'observed',
      confidence: null,
      status: '',
      objectIds: [k],
      passageIds: o.passageId ? [o.passageId] : [],
    });
  }
  for (const a of store.auditAll()) {
    if (!a.objectIds.some((id) => reach.has(id))) continue;
    events.push({
      id: `audit:${a.id}`,
      at: a.at,
      kind: a.action,
      summary: `${a.action} by ${a.actor} (${a.outcome})`,
      tag: a.actor.startsWith('engine') ? 'system' : 'analyst',
      confidence: null,
      status: a.outcome,
      objectIds: a.objectIds.filter((id) => reach.has(id)),
      passageIds: [],
    });
  }
  events.sort((x, y) => String(x.at).localeCompare(String(y.at)) || x.id.localeCompare(y.id));
  return { objectId, hops, objects: reach.size, events };
}
